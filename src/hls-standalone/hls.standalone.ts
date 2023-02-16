import { createReadStream, existsSync, mkdirSync } from "fs";
import { Server } from "http";
import { Observable, Subject, Subscription, catchError, delay, from, iif, map, mergeMap, of, retry, switchMap, tap, throwError, timeout, timer } from 'rxjs';
import _ from 'lodash';
import { HlsRegister } from "./hls";
import { resolve } from "path";
const detect = require('detect-port');
import express from "express";
const HlsServer = require('hls-server');
// import { v4Generator } from '@meeting-app/api-interfaces';
import { performance } from 'perf_hooks';
import { FileTransferred, HLSEvent, HLSEventTriggered } from "./event";
import { DateTime } from "luxon";
import { v4Generator } from "./Generator";
const ffmpeg = require('fluent-ffmpeg');


export interface ToHLSOptions { outputDir?: string, isRandomFileName?: boolean, outputFileName?: string, options?: string[] }

export class HlsStandalone {
    private _name = "HlsStandalone";
    private _host: string = "127.0.0.1";
    private _port: number = 8000;
    private _path: string = "/streams"; // Base URI to output Hls streams
    private _dir: string = "convert/hls"; // Directory that input files are stored
    // private _fileServeMap = new Map();
    private _DefaultHlsOptions = {};
    private _Event$: Subject<HLSEvent> = new Subject();
    private _EventLogLengthLimit = 100; // -1不限制
    private _EventLogs: HLSEventTriggered[] = [];

    private _httpServer: Server;
    private _app: express.Express = express();
    // private _server;
    private _hlsServer;

    public get host() {
        return this._host;
    }
    public get port() {
        return this._port;
    }
    public get path() {
        return this._path;
    }
    public get dir() {
        return this._dir;
    }
    // public get fileServeMap() {
    //     return this._fileServeMap;
    // }
    public get httpServer() {
        return this._httpServer;
    }
    public get app() {
        return this._app;
    }
    public get hlsServer() {
        return this._hlsServer;
    }
    public get Event$() {
        return this._Event$.asObservable();
    }
    private _heartbeatSubject = new Subject();

    private _heartbeatSubscription: Subscription;


    constructor(configs?: { host?: string, port?: number, path?: string, dir?: string }) {
        this.Event$
            .pipe(
                map(event => {
                    let now = DateTime.fromJSDate(new Date());
                    let eventPayload = new HLSEventTriggered({
                        dateTime: now.valueOf(),
                        from: `http://${this.host}:${this.port}${this.path}`,
                        event
                    });
                    if (this._EventLogs.length > this._EventLogLengthLimit) {
                        this._EventLogs.slice(this._EventLogs.length - this._EventLogLengthLimit);
                    }
                    if (HlsRegister.EventLogs.length > HlsRegister.EventLogLengthLimit) {
                        HlsRegister.EventLogs.slice(HlsRegister.EventLogs.length - HlsRegister.EventLogLengthLimit);
                    }
                    this._EventLogs.push(eventPayload);
                    HlsRegister.EventLogs.push(eventPayload);
                })
            )
            .subscribe();
        if (!!configs?.host) this._host = configs.host;
        if (!!configs?.port) this._port = configs.port;
        if (!!configs?.path) this._path = configs.path;
        if (!!configs?.dir) this._dir = configs.dir;

        if (!existsSync(`./${this.dir}`))
            mkdirSync(`./${this.dir}`, { "recursive": true });

        this.app.get('/', (req, res: express.Response) => {
            res.staHlsCode = 200;
            res.setHeader('Content-Type', 'text/html');
            res.sendFile(`${resolve(__dirname, "../../../public/hls/index.html")}`);
        });
        this.app.get('/convert-to-hls/:filename', (req, res: express.Response) => {
            console.log("url: ", req.url)
            console.log("params: ", req.params)
            let { filename } = req.params;
            this.ToHls$(`./uploads/video/${filename}`).subscribe(val => {
                res.send(val);
            })
        });

        this._hlsServer = new HlsServer(this._app, {
            path: this.path, // Base URI to output Hls streams
            dir: this.dir, // Directory that input files are stored
            provider: {
                exists: (req, callback) => { // check if a file exists (always called before the below methods)
                    // console.log("hlsServer.provider.exists", req.filePath);
                    let exists = existsSync(req.filePath);
                    callback(null, exists);
                    // callback(null, true)                 // File exists and is ready to start streaming
                    // callback(new Error("Server Error!")) // 500 error
                    // callback(null, false)                // 404 error
                },
                getManifestStream: (req, callback) => { // return the correct .m3u8 file
                    // "req" is the http request
                    // "callback" must be called with error-first arguments
                    callback(null, createReadStream(req.filePath));
                    // or
                    // callback(new Error("Server error!"), null)
                },
                getSegmentStream: (req, callback) => { // return the correct .ts file
                    callback(null, createReadStream(req.filePath, { highWaterMark: 64 * 1024 }));
                }
            }
        });


        process.on('uncaughtException', (error) => {
            let errorStr = String(error)
            // 其他处理机制
            if (errorStr.match(/listen EACCES: permission denied/) ||
                errorStr.match(/listen EADDRINUSE: address already in use/)) {
                let lastColonIndex = errorStr.lastIndexOf(":"),
                    portInString = errorStr.slice(lastColonIndex + 1);
                // this.httpServer.listening
                if (this.port == Number(portInString) && !this.httpServer.listening) {
                    HlsRegister.OccupiedPortSet.add(this.port);
                    HlsRegister.ServePortSet.delete(this.port)
                    this.getNewRandomPort();
                    this._port = this.newRandomPort;
                    HlsRegister.isPrintDetail ? console.log(`${errorStr}, retry with port `) : null;
                    console.log(this.httpServer.listening);
                    console.log(`${errorStr}, retry with port: ${this.port}`);
                    this.serverInitCount += 1;
                    this.initializeHlsServer();
                }
            }
        })
        this.initializeHlsServer();
    }


    private newRandomPort!: number;
    private getNewRandomPort = () => { this.newRandomPort = Math.floor(Math.random() * (HlsRegister.portRangeMax - HlsRegister.portRangeMin + 1) + HlsRegister.portRangeMin); return this.newRandomPort };
    // private getNewRandomPort = () => { this.newRandomPort = Math.floor(Math.random() * ((0 + 1) - (65535 - 1) + 1) + (65535 - 1)); return this.newRandomPort };

    serverInitCount = 0;
    private _initSub: Subscription;
    initializeHlsServer() {
        if (!!this._initSub) this._initSub.unsubscribe();
        const DetectPort = (portToDetect = this.port, detectPortCount = 0) => {
            let randomSec = Math.floor(Math.random() * (500 - 200 + 1) + 200);
            HlsRegister.isPrintDetail ? console.log(`[RetryCount] \n{detectPortCount: ${detectPortCount}, serverInitCount:${this.serverInitCount}}`) : null;
            return of({})
                .pipe(
                    // filter(() => !this.httpServer.listening),
                    delay(randomSec),  // delay every times
                    mergeMap(() => from(detect(portToDetect))),
                    switchMap((_port) => {

                        return iif(
                            () => {
                                let condition = portToDetect == _port && // 預測的 port與 檢查的 port若是相等意思就是無佔用
                                    !HlsRegister.ServePortSet.has(portToDetect) && // Sever若是已經被 listen則為占用
                                    !HlsRegister.OccupiedPortSet.has(portToDetect) && // 透過 detect-port檢查過已被占用的 port
                                    detectPortCount <= 20 && // retry detectPort 20 times
                                    this.serverInitCount <= 10; // retry detectPort 10 times

                                if (condition) {
                                    HlsRegister.isPrintDetail ? console.log(`port: ${portToDetect} was not occupied`) : null;
                                }
                                else {
                                    HlsRegister.OccupiedPortSet.add(portToDetect);
                                    this.getNewRandomPort();
                                    HlsRegister.isPrintDetail ? console.log(`port: ${portToDetect} was occupied, try port: ${this.newRandomPort}`) : null;
                                    this._port = this.newRandomPort;
                                }

                                return condition;
                            },
                            of(_port) // not occupied
                                .pipe(
                                    tap(() => {
                                        try {
                                            // if(!!this.httpServer) this.httpServer.close();
                                            this._httpServer = this._app.listen({ host: this.host, port: this.port }, () => {
                                                HlsRegister.ServePortSet.add(this.port);
                                                HlsRegister.ServerMap.set(`http://${this.host}:${this.port}${this.path}`, this)
                                                console.log(`[${new Date().toLocaleTimeString()}] hls server listening at http://${this.host}:${this.port}`);
                                            });

                                            // console.log(this.httpServer)
                                            this._httpServer.on('connection', (socket) => {
                                                HlsRegister.isPrintDetail ? console.log('httpServer connected!') : null;
                                                socket.on("data", (data) => {
                                                    HlsRegister.isPrintDetail ? console.log('socket data!') : null;
                                                    // console.log( data.toString())
                                                })
                                                socket.on("close", () => {
                                                    HlsRegister.isPrintDetail ? console.log('socket closed!') : null;
                                                })
                                                socket.on("drain", () => {
                                                    // this._heartbeatSubject.next("drain");
                                                    HlsRegister.isPrintDetail ? console.log("drain") : null;
                                                    // if (!this._heartbeatSubscription) {
                                                    //     this._heartbeatSubscription = this._heartbeatSubject.asObservable()
                                                    //         .pipe(
                                                    //             timeout(HlsRegister.heartbeatTimeoutDuration),
                                                    //             catchError(() => {
                                                    //                 return throwError(() => new Error('Heartbeat has stopped'));
                                                    //             })
                                                    //         )
                                                    //         .subscribe({
                                                    //             next: () => {
                                                    //                 HlsRegister.isPrintDetail ? console.log('Sending heartbeat...') : null;
                                                    //             },
                                                    //             error: (error) => {
                                                    //                 console.error(error);
                                                    //                 // HlsRegister.destroyServer(`http://${this.host}:${this.port}${this.path}`);
                                                    //                 // this._file = null;
                                                    //                 this._heartbeatSubscription = null;

                                                    //             }
                                                    //         })
                                                    // }
                                                })
                                            });
                                            this._httpServer.on('request', (message) => {
                                                HlsRegister.isPrintDetail ? console.log('httpServer request!', message.url) : null;
                                                let { url } = message; // url = "/streams/output2.m3u8";
                                                if (url.match(".m3u8")) {
                                                    let fileName = url.slice(1) // url = "streams/output2.m3u8";
                                                        .split("/")[1]; // url = "output2.m3u8";
                                                    // this._file = fileName;
                                                    // if (!this.fileServeMap.has(fileName)) this.fileServeMap.set(fileName, 0);
                                                    // let count = this.fileServeMap.get(fileName);
                                                    // count += 1;
                                                    // this.fileServeMap.set(fileName, count)
                                                }
                                            });


                                        } catch (error) {
                                            return throwError(() => error)
                                        }
                                    })
                                ),
                            of({}).pipe(
                                mergeMap(() => {
                                    detectPortCount += 1;
                                    return DetectPort(this.newRandomPort, detectPortCount)
                                })
                            )  // occupied, try port:
                        )
                    }),
                    retry({
                        delay: (err, count) => {
                            let randomSec = Math.floor(Math.random() * (500 - 200 + 1) + 200);
                            HlsRegister.isPrintDetail ? console.log('RetryCount: ', count, '\n', err) : null;
                            return timer(randomSec)
                        },
                        count: 10
                    }),
                    catchError(err => {
                        // console.log("DetectPort.catchError", err)
                        return of(err)
                    }),
                )
        };


        this._initSub = of({})
            .pipe(
                delay(50), // delay for other server
                mergeMap(() => DetectPort(this.port)),
            )
            .subscribe({
                next: data => {
                    // console.log(`HlsStandalone next: ${data}`);
                },
                error: error => {
                    console.log(`HlsStandalone error: ${error}`);
                },
                complete: () => {
                    // console.log('HlsStandalone Done!');
                }
            })
    }


    private _DefaultToHLSOptions: ToHLSOptions = {
        outputDir: "./convert/hls",
        isRandomFileName: false,
        outputFileName: v4Generator(),
        options: [
            // '-re',
            // '-stream_loop -1',
            '-c:v copy',
            '-c:a copy',
            // '-f flv',

            //   '-profile:v baseline', // for H264 video codec
            //   '-level 3.0',
            //   '-s 640x360', // 640px width, 360px height
            //   '-start_number 0', // start the first .ts segment at index 0
            '-hls_time 10', // 10 second segment duration
            '-hls_list_size 0', // Maximum number of playlist entries
            '-f hls', // HLS format
        ]
    };

    public get DefaultToHLSOptions() {
        return this._DefaultToHLSOptions
    }


    ToHlsPromise = async (filePath: string, configs: ToHLSOptions = this.DefaultToHLSOptions) => {
        let filePathSplit = filePath.split("/") // e.g. "./uploads/video/df89dca9-9d87-4f49-8600-625eeb137428.mp4"
        let originalFileName = filePathSplit[filePathSplit.length - 1] // e.g. "df89dca9-9d87-4f49-8600-625eeb137428.mp4"
            .split(".")[0]; // e.g. "df89dca9-9d87-4f49-8600-625eeb137428"
        configs['outputFileName'] = !!configs['isRandomFileName'] ? v4Generator() : originalFileName;
        return new Promise<{}>((_resolve, _reject) => {
            var startTime = performance.now();
            if (!existsSync(filePath)) _reject(`${filePath} is not exists!`);

            ffmpeg(filePath, { timeout: 432000 })
                .addOptions(configs.options)
                .output(`${configs.outputDir}/${configs.outputFileName}.m3u8`)
                .on('end', () => {
                    let endTime = performance.now();
                    let costTime = endTime - startTime;
                    // console.log('finish');
                    // console.log(`Call to doSomething took ${endTime - startTime} milliseconds`)

                    let eventPayload = new FileTransferred({
                        "outputFilePath": `${resolve(__dirname, '../../../', `${configs.outputDir}/${configs.outputFileName}.m3u8`)}`,
                        "executeTime": costTime
                    });
                    this._Event$.next(eventPayload);
                    HlsRegister.EventSubject.next(eventPayload);

                    console.log(`[Convert] toHls ${filePath} to ${configs.outputDir}/${configs.outputFileName}.m3u8 +${costTime}ms`)
                    // resolve(`${configs.outputDir}/${configs.outputFileName}.m3u8`);
                    _resolve({ url: `http://${this.host}:${this.port}${this.path}/${configs.outputFileName}.m3u8`, message: "Covert to HLS finished", costTime });

                })
                .run();
        });
    }

    ToHls$ = (filePath, configs: ToHLSOptions = this.DefaultToHLSOptions): Observable<any> => {
        return from(this.ToHlsPromise(filePath, configs))
        // .subscribe({
        //     next: data => {
        //         console.log(`convertToHls next: ${data}`);
        //     },
        //     error: error => {
        //         console.log(`convertToHls error: ${error}`);
        //     },
        //     complete: () => {
        //         // console.log('convertToHls Done!');
        //     }
        // })
    }


}

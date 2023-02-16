import { Subject, from } from "rxjs";
import { HlsStandalone } from "./hls.standalone";
import { exec } from "child_process";
import { promisify } from "util";
import { HLSEvent, HLSEventTriggered } from "./event";

function Singleton(target: any) {
    target.getInstance = function (args?: any) {
        if (!target.instance) {
            target.instance = new target(args);
        }
        return target.instance;
    }
}

@Singleton
class _HlsRegister {
    private static instance: _HlsRegister;
    static getInstance: () => _HlsRegister;
    private constructor() {
        this.init();
    }

    // 不提供修正，怕被複寫
    private _portRangeMin = 0 + 1; // 最小 port
    private _portRangeMax = 65535 - 1; // 最大 port
    private _OccupiedPortSet = new Set(); // 由 detect-port檢查到占用的 port
    private _ServePortSet = new Set(); // Hls server listen以後來註冊使用的 port
    private _ServerMap = new Map(); // 由 host+port作為 key，tus server作為 value
    private _isPrintDetail = false;
    private _heartbeatTimeoutDuration = 3 * 1000; // 超時時間 300 秒
    // private _heartbeatTimeoutDuration = 5 * 60 * 1000; // 超時時間 300 秒
    private _Event$: Subject<HLSEvent> = new Subject();
    private _EventLogLengthLimit = 500; // -1不限制
    private _EventLogs: HLSEventTriggered[] = [];


    // Getters
    public get portRangeMin() {
        return this._portRangeMin;
    }
    public get portRangeMax() {
        return this._portRangeMax;
    }
    public get OccupiedPortSet() {
        return this._OccupiedPortSet;
    }
    public get ServePortSet() {
        return this._ServePortSet;
    }
    public get ServerMap() {
        return this._ServerMap;
    }
    public get isPrintDetail() {
        return this._isPrintDetail;
    }
    public get heartbeatTimeoutDuration() {
        return this._heartbeatTimeoutDuration;
    }
    public get EventSubject() {
        return this._Event$;
    }
    public get Event$() {
        return this._Event$.asObservable();
    }
    public get EventLogLengthLimit() {
        return this._EventLogLengthLimit;
    }
    public get EventLogs() {
        return this._EventLogs;
    }


    getServer(key): HlsStandalone {
        if (!this.ServerMap.has(key)) {
            console.error(`key: ${key} not found`);
            return;
        }

        return this.ServerMap.get(key);
    }
    createServer(configs?: { host?: string; port?: number; path?: string; dir?: string; }) {
        let server = new HlsStandalone(configs);
        return server;
    }
    destroyServer(key) {
        console.log(`destroyServer: ${key}`)
        if (!this.ServerMap.has(key)) {
            console.error(`key: ${key} not found`);
            return;
        }
        let server = this.getServer(key);
        console.log(this.ServerMap)
        server.httpServer.close();
        return this.ServerMap.delete(key);
    }


    private promisifyExec = promisify(exec);
    private init() {
        from(this.promisifyExec('ffmpeg -version'))
            .pipe()
            .subscribe({
                next: ({ stdout, stderr }) => {
                    stdout = stdout.slice(0, 44);
                    console.log(`FFmpeg 已安装: ${stdout} (...)`);
                    if (!!stderr) console.error(`FFmpeg 未安装: ${stderr}`);
                },
                error: (err) => {
                    console.error(`FFmpeg 未安装: ${err}`);
                },
                complete: () => { }
            })
    }
}


export const HlsRegister = _HlsRegister.getInstance();


setTimeout(() => {

    try {

        HlsRegister.createServer();
    } catch (error) {
        console.log(error.toString())
    }
}, 500);
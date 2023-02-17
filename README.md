# Hls-standalone-server

[![NPM Version][npm-image]][npm-url]
[![NPM Downloads][downloads-image]][downloads-url]
[![Node.js Version][node-version-image]][node-version-url]
[![License - MIT](https://img.shields.io/badge/License-MIT-2ea44f?logo=license)](LICENSE)


## Default config:
```js
{
    host: "127.0.0.1",
    port: 8000,
    path: "/streams",  // Base URI to output Hls streams
    dir: "convert/hls" // Directory that input files are stored
 }  
 ```
## Example

```ts
import {HlsStandalone, HlsRegister} from "hls-standalone-server"

let HlsServer1 = HlsRegister.createServer();
let HlsServer2 = HlsRegister.createServer({port: 3000});

console.log(HlsRegister):

/** read only */
_HlsRegister {
  /** What is the smallest port used randomly when the port is occupied */
  portRangeMin: 1, 
  /** What is the biggest port used randomly when the port is occupied */
  portRangeMax: 65534, 
  /** Upon using detect-port to check, it was discovered that the port is already in use. */
  OccupiedPortSet: Set(0) {},
  /** The port that is occupied after the server successfully starts. */
  ServePortSet: Set(2) { 8000, 3000 },
  ServerMap: Map(2) {
    'http://127.0.0.1:8000/streams' => HlsStandalone {
      _name: 'HlsStandalone',
      _host: '127.0.0.1',
      _port: 8000,
      _path: '/streams',
      _dir: 'convert/hls',
      _DefaultHlsOptions: {},
      '_Event$': [Subject],
      _EventLogLengthLimit: 100,
      _EventLogs: [],
      _app: [Function],
      _heartbeatSubject: [Subject],
      getNewRandomPort: [Function (anonymous)],
      serverInitCount: 0,
      _DefaultToHLSOptions: [Object],
      ToHlsPromise: [AsyncFunction (anonymous)],
      'ToHls$': [Function (anonymous)],
      _hlsServer: [HLSServer],
      _initSub: [SafeSubscriber],
      _httpServer: [Server]
    },
    'http://127.0.0.1:3000/streams' => HlsStandalone {...}
  },
  Event$: Observable {...},
}
```
## Features

#### GET handler
* http://```<HOST>```:```<PORT>```/convert-to-hls/```:<FILENAME>```.mp4   
  The original video must be under the path as "`./uploads/video/${filename}`", this service only transform by local. Can be combined use with library "tus-standalone-server"
  ```
   e.g.
   http://127.0.0.1:3000/convert-to-hls/test.mp4
  ```

* http://```<HOST>```:```<PORT>```/```<PATH>```/```:<FILENAME>```.m3u8  
  You can watch video by this URL
  ```
   e.g.
   http://127.0.0.1:3000/stream/test.m3u8
  ```

<!-- 說明小圖示 -->
[npm-image]: https://img.shields.io/npm/v/hls-standalone-server.svg?logo=npm
[npm-url]: https://www.npmjs.com/package/hls-standalone-server
[node-version-image]: https://img.shields.io/node/v/hls-standalone-server.svg?logo=node.js
[node-version-url]: https://nodejs.org/en/download
[downloads-image]: https://img.shields.io/npm/dm/hls-standalone-server.svg
[downloads-url]: https://npmjs.org/package/hls-standalone-server

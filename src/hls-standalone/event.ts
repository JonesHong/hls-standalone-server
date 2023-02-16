export abstract class Action {
    readonly type: string;
    constructor(payload?: any) { }
}
export const ActionMap = {
    HLSEventTriggered: "[HLS] HLS Event Triggered",
    FileTransferred: '[HLS] File Transferred'
}

/**
 * Fired when a POST request successfully creates a new file
 */
export class FileTransferred extends Action {
    readonly type: string = ActionMap.FileTransferred;
    constructor(public payload: { outputFilePath: string, executeTime: number }) {
        super();
    }
}
export type HLSEvent = FileTransferred;

export class HLSEventTriggered extends Action {
    readonly type: string = ActionMap.HLSEventTriggered;
    constructor(public payload: { dateTime: number, from: string, event: HLSEvent }) {
        super();
    }
}

export type ActionUnion = FileTransferred | HLSEventTriggered;
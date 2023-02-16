import { Request, Response } from 'express';

// type nextFunction = (/err)
export interface FileUploadBaseOptions {
    isRandomFileName?: boolean;
    splitFileByMIMEType?: null | 'type' | 'MIMEType'; // (default: "type")
    splitFileByFunctionality?: string;
    /**
     * output filePath == destination == directory
     * (default: "./uploads")
     */
    filePathToSave?: string;
}

export interface FileUploadTusOptions extends FileUploadBaseOptions {
    // isSharedFile?: boolean;
    isSavingFileToTemp?: boolean; // (default: false)
    tempFilePathToSave?: string; // (default: '/uploads/temp')
}

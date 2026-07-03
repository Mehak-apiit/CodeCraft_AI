import {NextFunction, Request, Response} from "express";
export function handleExpressError(err: Error, req: Request, res: Response, next: NextFunction) {
    //set default status code if it is not already set
    const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
    res.status(statusCode).json({
        error: {
            message: err.message,
            status: statusCode,
        },
    });

    
}
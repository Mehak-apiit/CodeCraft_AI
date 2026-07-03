import express, {Router} from "express";
import cors from "cors";
import {Express,NextFunction, Request, Response} from "express";
//import {handleExpressError} from "../exceptions/handleExpressError";
import { handleExpressError } from "../exceptions/handleExpressError";
export function expressServer(app: Express, PORT: number){
    const router = Router();
    app.use(cors({
        origin:'*',
        credentials:true,
    }));
    app.use(express.json());
    app.use(express.urlencoded({extended:true}));
    app.use(handleExpressError);
    app.get('/', async (req: Request, res: Response) => {
        res.json({message: "Server is up"});
    })
    app.listen(PORT,()=>{
        console.log(`Express server is running at http://localhost:${PORT}`);
    })

}

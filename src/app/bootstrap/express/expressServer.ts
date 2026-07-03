import express, {Router} from "express";
import cors from "cors";
import {Express,NextFunction, Request, Response} from "express";
import { handleExpressError } from "../exceptions/handleExpressError";
import passport from "passport";
import session from "express-session";
import {Strategy as GitHubStrategy} from "passport-github2";
import MongoStore from "connect-mongo";
import { UserService } from "../../services/UserService";
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
    const sess = {
        store: MongoStore.create({
            mongoUrl: process.env.DB_URL,
            collectionName: 'sessions',
        }),
        secret: process.env.COOKIE_KEY as string,
        resave: false,
        saveUninitialized: false,
        cookie: {secure:false}
    }
    if(process.env.NODE_ENV === 'production'){
        app.set('trust proxy', 1);
    }
    app.use(session(sess));
    app.use(passport.initialize());
    app.use(passport.session());

    passport.use(
        new GitHubStrategy(
            {
                clientID: process.env.GITHUB_CLIENT_ID as string,
                clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
                callbackURL: process.env.CALL_BACK_URL as string,
            },
            async(accessToken: string, refreshToken: string, profile: any, done: any) => {
                try {
                    const id = profile?.id;
                    const name = profile?.displayName;
                    const image = profile?.photos?.[0]?.value;
                    const email = profile?.emails?.[0]?.value || null;
                    const userService = UserService.getInstance();
                    await userService.createUser({
                        id,
                        name,
                        image,
                        email,
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });
                    return done(null,{id,name,image});
                    
                } catch (error) {
                     return done(error);
                }
            }
        )
    )
    passport.serializeUser((user:any,done)=>{
        done(null,user);
    });
    passport.deserializeUser(async(obj:any,done)=>{
        try {
            done(null,obj);
        } catch (err) {
            done(err);
            
        }
    })
    app.get('/auth/github', passport.authenticate('github', {scope: ['user:email']}));
    app.get(
        "/auth/github/callback",
        passport.authenticate("github", { failureRedirect: "/auth/login",
            successRedirect: "process.env.FRONT_APP_URL",
         })
    )
    app.listen(PORT,()=>{
        console.log(`Express server is running at http://localhost:${PORT}`);
    })

}

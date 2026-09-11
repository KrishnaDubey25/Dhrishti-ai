import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import type {User} from '../types';
import {login as loginSvc,registerPatient} from '../services/db';
const SESSION='drishti_session_v1';
type Ctx={user:User|null;login:(e:string,p:string)=>User;register:(n:string,e:string,p:string)=>User;logout:()=>void;setUser:(u:User|null)=>void};
const AuthContext=createContext<Ctx|null>(null);
export function AuthProvider({children}:{children:React.ReactNode}){const [user,setUser]=useState<User|null>(()=>{try{return JSON.parse(localStorage.getItem(SESSION)||'null')}catch{return null}});useEffect(()=>{user?localStorage.setItem(SESSION,JSON.stringify(user)):localStorage.removeItem(SESSION)},[user]);const value=useMemo<Ctx>(()=>({user,setUser,login:(e,p)=>{const u=loginSvc(e,p);if(!u)throw new Error('Invalid email or password');setUser(u);return u},register:(n,e,p)=>{const u=registerPatient(n,e,p);setUser(u);return u},logout:()=>setUser(null)}),[user]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}
export const useAuth=()=>{const c=useContext(AuthContext);if(!c)throw new Error('Auth context missing');return c}

import type {Metadata} from "next";
import ResetPassword from "@/components/reset-password";
export const metadata:Metadata={title:"Definir palavra-passe · Umbral",robots:{index:false,follow:false},referrer:"no-referrer"};
export default function Page(){return <ResetPassword/>}

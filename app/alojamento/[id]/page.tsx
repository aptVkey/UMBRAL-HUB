import type {Metadata} from "next";
import PropertyBrochure from "@/components/property-brochure";
export const metadata:Metadata={title:"Alojamento · Umbral",robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <PropertyBrochure id={id}/>}

/** Shared layout must not initialize the default runtime when rendering a rich route. */
type PatientRecord={patient:{displayName:string}};
export async function navigationPatientName(profile:string|null,readDefault:()=>Promise<PatientRecord>,readRich:()=>Promise<PatientRecord>):Promise<string> {
 return (await (profile==="rich-synthetic" ? readRich() : readDefault())).patient.displayName;
}

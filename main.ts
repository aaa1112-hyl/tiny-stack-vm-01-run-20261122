// Tiny Stack VM: interpreter for make.fun's tiny stack ISA v1. Reads
// /input/<id>/program.bin + input.bin, writes /output/<id>/stdout.bin
// and /output/<id>/exit.txt. 32-bit wrapping values, 256-value stack,
// 64 return addresses, 256 words of memory, ten traps, step limit
// 1,000,000, output limit 65,536 bytes.
import {mkdirSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
// [opcode, immediate bytes, pops, pushes]; a byte not listed traps 5.
const T=[[0,0,0,0],[1,1,0,1],[2,4,0,1],[3,0,1,0],[4,0,1,2],[5,0,2,2],[6,0,2,3],[7,0,3,3],[16,0,2,1],[17,0,2,1],[18,0,2,1],[19,0,2,1],[20,0,2,1],[21,0,2,1],[22,0,2,1],[23,0,1,1],[24,0,2,1],[25,0,2,1],[26,0,2,1],[27,0,1,1],[28,0,2,1],[29,0,2,1],[30,0,2,1],[32,0,2,1],[33,0,2,1],[34,0,2,1],[48,2,0,0],[49,2,1,0],[50,2,1,0],[51,2,0,0],[52,0,0,0],[64,0,1,1],[65,0,2,0],[80,0,1,0],[81,0,1,0],[82,0,0,1],[83,0,1,0]];
const IM=new Uint8Array(256),NE=new Uint8Array(256),MA=new Uint8Array(256),KN=new Uint8Array(256);
for(const[o,i,p,q]of T){IM[o]=i;NE[o]=p;MA[o]=q;KN[o]=1;}
const DG=new Uint8Array(12); // PRINT's digits, written backwards
function run(p,g){const n=p.length,S=new Int32Array(256);let sp=0;const C=new Int32Array(64);let cp=0;const M=new Int32Array(256),out=new Uint8Array(65536);let ol=0,ip=0,pc=0,st=0;const end=c=>({out:out.subarray(0,ol),code:c});
for(;;){ // checks in ISA.md's order: step limit, pc, opcode, immediate, stack needs, then the instruction's own traps
if(st===1e6)return end(10);if(pc<0||pc>=n)return end(9);const o=p[pc];if(!KN[o])return end(5);const im=IM[o];if(pc+im>=n)return end(9);st++;const nx=pc+1+im;if(sp<NE[o])return end(2);if(sp-NE[o]+MA[o]>256)return end(3);pc=nx;
switch(o){
case 0:return end(0);
case 1:S[sp++]=(p[nx-1]<<24)>>24;break;
case 2:S[sp++]=p[nx-4]|(p[nx-3]<<8)|(p[nx-2]<<16)|(p[nx-1]<<24);break;
case 3:sp--;break;
case 4:S[sp]=S[sp-1];sp++;break;
case 5:{const t=S[sp-1];S[sp-1]=S[sp-2];S[sp-2]=t;break;}
case 6:S[sp]=S[sp-2];sp++;break;
case 7:{const a=S[sp-3];S[sp-3]=S[sp-2];S[sp-2]=S[sp-1];S[sp-1]=a;break;}
case 23:S[sp-1]=(-S[sp-1])|0;break;
case 27:S[sp-1]=~S[sp-1];break;
case 16:case 17:case 18:case 19:case 20:case 21:case 22:case 24:case 25:case 26:case 28:case 29:case 30:case 32:case 33:case 34:{const b=S[sp-1],a=S[sp-2];let r;
if(o===16)r=(a+b)|0;else if(o===17)r=(a-b)|0;else if(o===18)r=Math.imul(a,b);
else if(o===19){if(!b)return end(4);r=a===-2147483648&&b===-1?a:(a/b)|0;}
else if(o===20){if(!b)return end(4);r=b===-1?0:(a%b)|0;}
else if(o===21){if(!b)return end(4);r=Math.floor((a>>>0)/(b>>>0))|0;}
else if(o===22){if(!b)return end(4);r=((a>>>0)%(b>>>0))|0;}
else if(o===24)r=a&b;else if(o===25)r=a|b;else if(o===26)r=a^b;
else if(o===28)r=a<<(b&31);else if(o===29)r=a>>(b&31);else if(o===30)r=(a>>>(b&31))|0;
else if(o===32)r=a===b?1:0;else if(o===33)r=a<b?1:0;else r=(a>>>0)<(b>>>0)?1:0;
sp-=2;S[sp++]=r;break;}
case 48:case 49:case 50:{const rel=((p[nx-2]|(p[nx-1]<<8))<<16)>>16;if(o===48)pc=nx+rel;else{const v=S[--sp];if((o===49)===(v===0))pc=nx+rel;}break;}
case 51:if(cp===64)return end(7);C[cp++]=nx;pc=p[nx-2]|(p[nx-1]<<8);break;
case 52:if(!cp)return end(8);pc=C[--cp];break;
case 64:{const a=S[sp-1];if(a<0||a>=256)return end(6);S[sp-1]=M[a];break;}
case 65:{const a=S[sp-1],v=S[sp-2];if(a<0||a>=256)return end(6);sp-=2;M[a]=v;break;}
case 80:{const v=S[sp-1];let u=v<0?-v:v,len=v<0?1:0,t=u;do{len++;t=Math.floor(t/10);}while(t>0);if(ol+len>65536)return end(11);sp--;if(v<0)out[ol++]=45;let d=0;do{DG[d++]=48+(u%10);u=Math.floor(u/10);}while(u>0);while(d>0)out[ol++]=DG[--d];break;}
case 81:if(ol+1>65536)return end(11);out[ol++]=S[--sp]&255;break;
case 82:S[sp++]=ip<g.length?g[ip++]:-1;break;
case 83:return end(S[--sp]&255);
}}}
const I=process.env.MAKEFUN_INPUT_DIR??'/input',O=process.env.MAKEFUN_OUTPUT_DIR??'/output';
for(const id of readdirSync(I).sort()){const r=run(new Uint8Array(readFileSync(join(I,id,'program.bin'))),new Uint8Array(readFileSync(join(I,id,'input.bin'))));mkdirSync(join(O,id),{recursive:true});writeFileSync(join(O,id,'stdout.bin'),r.out);writeFileSync(join(O,id,'exit.txt'),`${r.code}\n`);}

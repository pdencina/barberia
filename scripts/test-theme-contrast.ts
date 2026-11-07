// Verifica las parejas de color de los tokens reales, sin red ni base.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const css = readFileSync("src/app/color-themes.css", "utf8");
function rgb(value: string): number[] {
  const [h,s,l]=value.match(/[\d.]+/g)!.map(Number);
  const saturation=s/100,light=l/100;
  const a=saturation*Math.min(light,1-light);
  return [0,8,4].map(n=>{const k=(n+h/30)%12;return light-a*Math.max(-1,Math.min(k-3,9-k,1));});
}
function luminance(color: number[]) {return color.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a: number[],b: number[]) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
let checks=0;
for (const theme of ["rose","monochrome","monochrome-dark"]) {
  const block=css.match(new RegExp(`html\\[data-color-theme="${theme}"\\] \\{([^}]+)\\}`))?.[1];
  assert.ok(block,`Debe existir ${theme}`);
  const tokens: Record<string,number[]>={};
  for (const match of Array.from(block.matchAll(/--([\w-]+): ([^;]+);/g))) tokens[match[1]]=rgb(match[2]);
  for (const [text,surface] of [["foreground","background"],["card-foreground","card"],["muted-foreground","card"],["foreground","secondary"],["muted-foreground","secondary"],["primary-foreground","primary"],["brand-gray","brand-white"],["brand-blue","card"],["accent-foreground","accent"],...(theme === "rose" ? [["foreground","rose-summary"],["muted-foreground","rose-summary"],["primary-foreground","rose-active"]] : [])]) {
    const ratio=contrast(tokens[text],tokens[surface]);assert.ok(ratio>=4.5,`${theme} ${text}/${surface}: ${ratio.toFixed(2)} debe ser >=4.5`);checks++;console.log(`OK ${theme} ${text}/${surface}: ${ratio.toFixed(2)}`);
  }
}
console.log(`${checks} parejas de contraste correctas`);

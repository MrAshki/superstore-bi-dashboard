import { getFontEmbedCSS, toBlob } from "html-to-image";
import { filenames, reportViews } from "@/components/reports";

export type ReportImage = { filename: string; url: string };

// هر تصویر از layout ثابت گزارش ساخته می‌شود؛ صفحهٔ تعاملی کوچک یا فشرده نمی‌شود.
export async function captureReports(): Promise<ReportImage[]> {
  await document.fonts.ready;
  await new Promise<void>(resolve => requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
  const nodes=reportViews.map(view=>document.querySelector<HTMLElement>(`[data-report="${view}"]`));
  if(nodes.some(node=>!node)) throw new Error("Report layout is not ready");
  const fontEmbedCSS=await getFontEmbedCSS(nodes[0]!);
  const images: ReportImage[]=[];
  try {
    for(let i=0;i<nodes.length;i++) {
      const node=nodes[i]!;
      if(node.scrollHeight>node.clientHeight+1 || node.scrollWidth>node.clientWidth+1) throw new Error("Report content does not fit");
      const blob=await toBlob(node,{width:node.clientWidth,height:node.clientHeight,pixelRatio:2,backgroundColor:"#F8FAFC",fontEmbedCSS,cacheBust:false});
      if(!blob) throw new Error("Image rendering failed");
      images.push({filename:filenames[i],url:URL.createObjectURL(blob)});
    }
    return images;
  } catch(error) {
    images.forEach(image=>URL.revokeObjectURL(image.url));
    throw error;
  }
}

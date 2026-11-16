import {readFile as readFileDefault} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';

// Keep the original failed case and the existing single screenshot attempt.
// A failed capture is evidence, not a replacement error or a passing result.
export async function recordQualityFailureScreenshot(row,page,file,{readFile=readFileDefault}={}) {
  const capture={file:path.basename(file)};
  try {
    await page.screenshot({path:file});
  } catch(error) {
    row.failureScreenshot={...capture,status:'unavailable',error:String(error)};
    return row.failureScreenshot;
  }
  try {
    const bytes=await readFile(file);
    row.failureScreenshot={...capture,status:'captured',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  } catch(error) {
    row.failureScreenshot={...capture,status:'unverified',error:String(error)};
  }
  return row.failureScreenshot;
}

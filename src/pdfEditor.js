import * as pdfjsLib from 'pdfjs-dist/build/pdf';

import workerSrc from 'pdfjs-dist/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

export class PdfEditor {
  constructor() {
    this.init();
  }

  init() {
    const div = document.createElement('div');
    div.innerHTML = this.crDiv();
    div.style.cssText = 'position: fixed;top: 0;bottom: 0;right: 0;left: 0;';
    document.body.append(div);

    console.log(33333, div);
  }

  crDiv() {
    const html = `<iframe id="pdf-js-viewer" src="/web/viewer.html" title="webviewer" frameborder="0" width="100%" height="100%"></iframe>`;

    return html;
  }
}

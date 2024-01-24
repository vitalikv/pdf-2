import * as pdfjsLib from 'pdfjs-dist/webpack';

import { container } from './index';

// сбоник примеров
// https://snyk.io/advisor/npm-package/pdfjs-dist/functions/pdfjs-dist.SVGGraphics
// https://snyk.io/advisor/npm-package/pdfjs-dist/example

// установка
// https://www.npmjs.com/package/pdfjs-dist  pdf to svg  установка npm i pdfjs-dist
// npm install pdfjs-dist @types/pdfjs-dist  установка @types
// https://github.com/mozilla/pdf.js/tree/master/examples/webpack  установка pdf.js для webpack (import * as pdfjsLib from 'pdfjs-dist/webpack';)

//import { isometricSvgElem, isometricSheets, isometricStampLogo } from './index';

// конвертация pdf в svg и добавление на страницу
export class IsometricPdfToSvg {
  container;
  containerSvg;
  inputFile;
  containerPdf;
  canvasPdf;
  scalePdf = 1;
  cssText = 'position: absolute; top: 50%; left: 50%; width: 100%; height: 100%;';
  format = { size: 'a3', orientation: 'landscape' };

  constructor() {
    this.init();
    this.inputFile = this.createInputFile();
  }

  init() {
    this.container = container;
    this.addDefCanvas();
  }

  addDefCanvas() {
    const div = document.createElement('div');
    div.style.cssText =
      'display: flex; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; right: 0; bottom: 0; transform-origin: center center; background: rgb(255, 255, 255); user-select: none; z-index: 2;';

    this.containerPdf = div;
    this.container.prepend(div);

    const canvas = document.createElement('canvas');
    div.appendChild(canvas);

    canvas.width = 5357;
    canvas.height = 3788;

    canvas.style.cssText = this.cssText;

    this.scalePdf = 1;
    this.canvasPdf = canvas;

    this.updateCanvasPdf();
  }

  createInputFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.style.cssText = 'position: absolute; display: none;';

    input.onchange = (e) => {
      if (e.target.files.length > 0) {
        if (e.target.files[0].type.indexOf('pdf') === -1) return;

        const reader = new FileReader();
        reader.onload = () => {
          //start({ file: reader.result });
          this.parsePdf({ file: reader.result });
        };
        reader.readAsDataURL(e.target.files[0]);

        input.value = '';
      }
    };

    return input;
  }

  setFormatSize(value) {
    format.size = value;
  }

  setFormatOrientation(value) {
    format.orientation = value;
  }

  parsePdf({ file }) {
    if (this.canvasPdf) {
      this.cssText = this.canvasPdf.style.cssText;
      this.canvasPdf.remove();
    }

    //this.deletePdf();
    //const pdf = new pdfjsLib.getDocument('./img/1.pdf');
    const pdf = new pdfjsLib.getDocument(file);

    pdf.promise.then(
      (pdf) => {
        const totalPages = pdf.numPages;

        for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
          pdf.getPage(pageNumber).then((page) => {
            this.addSvgPage(page);
          });
        }
      },
      (reason) => {
        console.error(reason);
      }
    );
  }

  addSvgPage(page) {
    const viewport = page.getViewport({ scale: 4.5, rotation: 0 });

    if (!this.containerPdf) {
      const div = document.createElement('div');
      div.style.cssText =
        'display: flex; align-items: center; justify-content: center; position: absolute; top: 0; left: 0; right: 0; bottom: 0; transform-origin: center center; background: rgb(255, 255, 255); user-select: none; z-index: 2;';

      this.containerPdf = div;
      this.container.prepend(div);
    }

    //this.scalePdf = 1;
    this.canvasPdf = this.pdfToCanvas({ div: this.containerPdf, page, viewport });

    console.log(this.canvasPdf);
    this.updateCanvasPdf();
    //this.pdfToSvg({ div, page, viewport });
  }

  async pdfToSvg({ div, page, viewport }) {
    const opList = await page.getOperatorList();
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    //svgGfx.embedFonts = true;
    const svg = await svgGfx.getSVG(opList, viewport);
    div.children[0].prepend(svg);

    svg.setAttribute('pdf', true);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    //svg.removeAttribute('viewBox')

    div.innerHTML = div.innerHTML
      .replace('svg:svg', 'svg') // strip :svg to allow skipping namespace
      .replace(/&lt;(\/|)svg:/g, '&lt;$1');

    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    svg.removeAttribute('version');
  }

  pdfToCanvas({ div, page, viewport }) {
    const canvas = document.createElement('canvas');
    div.appendChild(canvas);

    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    page.render({ canvasContext: context, viewport });

    canvas.style.cssText = this.cssText;

    canvas.onmousedown = (e) => {
      console.log(e);
    };
    return canvas;
  }

  rotateSvg = ({ degree }) => {
    if (!this.containerPdf) return;

    const angle = degree;
    const rad = (angle * Math.PI) / 180;

    const image = this.canvasPdf;
    const w = image.width;
    const h = image.height;
    const width = Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad));
    const height = Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const cos_Height = image.height * Math.abs(Math.cos(rad));
    const sin_Width = image.width * Math.abs(Math.sin(rad));

    let xOrigin, yOrigin;

    if (angle === 90) {
      xOrigin = width;
      yOrigin = Math.min(cos_Height, sin_Width);
    }
    if (angle === -90) {
      xOrigin = 0;
      yOrigin = Math.max(cos_Height, sin_Width);
    }

    const ctx = canvas.getContext('2d');

    ctx.save();
    ctx.translate(xOrigin, yOrigin);
    ctx.rotate(rad);
    ctx.drawImage(image, 0, 0);
    ctx.restore();

    canvas.style.top = this.canvasPdf.style.top;
    canvas.style.left = this.canvasPdf.style.left;

    this.replaceCanvas(canvas);

    this.updateCanvasPdf();
  };

  rotate(x, y, a) {
    var cos = Math.cos,
      sin = Math.sin,
      a = (a * Math.PI) / 180;

    let xr = x * cos(a) - y * sin(a);
    let yr = x * sin(a) + y * cos(a);

    return [xr, yr];
  }

  replaceCanvas(canvas) {
    this.canvasPdf.remove();
    this.canvasPdf = canvas;
    this.containerPdf.append(this.canvasPdf);
  }

  updateCanvasPdf() {
    const div = this.containerPdf;

    const canvas = this.canvasPdf;
    const width = canvas.width;
    const height = canvas.height;

    const width2 = div.clientWidth;
    const height2 = div.clientHeight;

    const aspect = width / width2 > height / height2 ? width / width2 : height / height2;

    canvas.style.position = 'absolute';
    canvas.style.width = (canvas.width / aspect) * this.scalePdf + 'px';
    canvas.style.height = (canvas.height / aspect) * this.scalePdf + 'px';
    canvas.style.transform = 'translateX(-50%) translateY(-50%)';
    canvas.style.border = '4px solid #515151';
    canvas.style.boxSizing = 'border-box';
    canvas.style.zIndex = '3';
  }

  setScale({ value }) {
    if (!this.canvasPdf) return;
    value = Number(value) / 100;

    this.scalePdf = value;

    this.updateCanvasPdf();

    //isometricStampLogo.setScale(this.scalePdf);

    //isometricSheets.setStyle(this.canvasPdf.style.cssText);
  }

  deletePdf() {
    if (!this.containerPdf) return;

    this.containerPdf.remove();
  }
}

// let PDFJS;
// let pdfDocument;
// let PAGE_HEIGHT;
// const DEFAULT_SCALE = 1.33;

// function start({ file }) {
//   PDFJS = new pdfjsLib.getDocument(file);

//   PDFJS.promise.then(
//     (pdf) => {
//       pdfDocument = pdf;
//       console.log(pdf);
//       let viewer = document.getElementById('viewer');
//       for (let i = 0; i < pdf._pdfInfo.numPages; i++) {
//         let page = createEmptyPage(i + 1);
//         viewer.appendChild(page);
//       }

//       loadPage(1).then((pdfPage) => {
//         let viewport = pdfPage.getViewport({ scale: DEFAULT_SCALE, rotation: 0 });
//         PAGE_HEIGHT = viewport.height;
//         document.body.style.width = `${viewport.width}px`;
//       });
//     },
//     (reason) => {
//       console.error(reason);
//     }
//   );

//   // PDFJS = new pdfjsLib.getDocument('./img/example.pdf');
//   // //PDFJS.workerSrc = './pdf.worker.js';
//   // PDFJS.then((pdf) => {
//   //   pdfDocument = pdf;

//   //   let viewer = document.getElementById('viewer');
//   //   for (let i = 0; i < pdf.pdfInfo.numPages; i++) {
//   //     let page = createEmptyPage(i + 1);
//   //     viewer.appendChild(page);
//   //   }

//   //   loadPage(1).then((pdfPage) => {
//   //     let viewport = pdfPage.getViewport(DEFAULT_SCALE);
//   //     PAGE_HEIGHT = viewport.height;
//   //     document.body.style.width = `${viewport.width}px`;
//   //   });
//   // });
// }

// window.addEventListener('scroll', handleWindowScroll);

// function createEmptyPage(num) {
//   let page = document.createElement('div');
//   let canvas = document.createElement('canvas');
//   let wrapper = document.createElement('div');
//   let textLayer = document.createElement('div');

//   page.className = 'page';
//   wrapper.className = 'canvasWrapper';
//   textLayer.className = 'textLayer';

//   page.setAttribute('id', `pageContainer${num}`);
//   page.setAttribute('data-loaded', 'false');
//   page.setAttribute('data-page-number', num);

//   canvas.setAttribute('id', `page${num}`);

//   page.appendChild(wrapper);
//   page.appendChild(textLayer);
//   wrapper.appendChild(canvas);

//   return page;
// }

// function loadPage(pageNum) {
//   return pdfDocument.getPage(pageNum).then((pdfPage) => {
//     let page = document.getElementById(`pageContainer${pageNum}`);
//     let canvas = page.querySelector('canvas');
//     let wrapper = page.querySelector('.canvasWrapper');
//     let container = page.querySelector('.textLayer');
//     let canvasContext = canvas.getContext('2d');
//     let viewport = pdfPage.getViewport({ scale: DEFAULT_SCALE, rotation: 0 });

//     canvas.width = viewport.width * 2;
//     canvas.height = viewport.height * 2;
//     page.style.width = `${viewport.width}px`;
//     page.style.height = `${viewport.height}px`;
//     wrapper.style.width = `${viewport.width}px`;
//     wrapper.style.height = `${viewport.height}px`;
//     container.style.width = `${viewport.width}px`;
//     container.style.height = `${viewport.height}px`;

//     pdfPage.render({
//       canvasContext,
//       viewport,
//     });

//     pdfPage.getTextContent().then((textContent) => {
//       pdfjsLib.renderTextLayer({
//         textContentSource: textContent,
//         container,
//         viewport,
//         textDivs: [],
//       });
//     });

//     page.setAttribute('data-loaded', 'true');

//     return pdfPage;
//   });
// }

// function handleWindowScroll() {
//   let visiblePageNum = Math.round(window.scrollY / PAGE_HEIGHT) + 1;
//   let visiblePage = document.querySelector(`.page[data-page-number="${visiblePageNum}"][data-loaded="false"]`);
//   if (visiblePage) {
//     setTimeout(function () {
//       loadPage(visiblePageNum);
//     });
//   }
// }

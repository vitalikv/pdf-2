/* Copyright 2022 Mozilla Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { AnnotationEditor } from "./editor.js";
import { AnnotationEditorType } from "../../shared/util.js";
import { PixelsPerInch } from "../display_utils.js";
import { StampAnnotationElement } from "../annotation_layer.js";

/**
 * Basic text editor in order to create a FreeTex annotation.
 */
class StampEditor extends AnnotationEditor {
  #bitmap = null;

  #bitmapId = null;

  #bitmapPromise = null;

  #bitmapUrl = null;

  #canvas = null;

  #observer = null;

  #resizeTimeoutId = null;

  #isSvg = false;

  static _type = "stamp";

  constructor(params) {
    super({ ...params, name: "stampEditor" });
    this.#bitmapUrl = params.bitmapUrl;
  }

  #getBitmap() {
    if (this.#bitmapId) {
      this._uiManager.imageManager.getFromId(this.#bitmapId).then(data => {
        if (!data) {
          this.remove();
          return;
        }
        this.#bitmap = data.bitmap;
        this.#createCanvas();
      });
      return;
    }

    if (this.#bitmapUrl) {
      const url = this.#bitmapUrl;
      this.#bitmapUrl = null;
      this.#bitmapPromise = this._uiManager.imageManager
        .getFromUrl(url)
        .then(data => {
          this.#bitmapPromise = null;
          if (!data) {
            this.remove();
            return;
          }
          ({
            bitmap: this.#bitmap,
            id: this.#bitmapId,
            isSvg: this.#isSvg,
          } = data);
          this.#createCanvas();
        });
      return;
    }

    const input = document.createElement("input");
    if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("TESTING")) {
      input.hidden = true;
      input.id = "stampEditorFileInput";
      document.body.append(input);
    }
    input.type = "file";
    input.accept = "image/*";
    this.#bitmapPromise = new Promise(resolve => {
      input.addEventListener("change", async () => {
        this.#bitmapPromise = null;
        if (!input.files || input.files.length === 0) {
          this.remove();
        } else {
          const data = await this._uiManager.imageManager.getFromFile(
            input.files[0]
          );
          if (!data) {
            this.remove();
            return;
          }
          ({
            bitmap: this.#bitmap,
            id: this.#bitmapId,
            isSvg: this.#isSvg,
          } = data);
          this.#createCanvas();
        }
        if (typeof PDFJSDev !== "undefined" && PDFJSDev.test("TESTING")) {
          input.remove();
        }
        resolve();
      });
      input.addEventListener("cancel", () => {
        this.#bitmapPromise = null;
        this.remove();
        resolve();
      });
    });
    if (typeof PDFJSDev === "undefined" || !PDFJSDev.test("TESTING")) {
      input.click();
    }
  }

  /** @inheritdoc */
  remove() {
    if (this.#bitmapId) {
      this.#bitmap = null;
      this._uiManager.imageManager.deleteId(this.#bitmapId);
      this.#canvas?.remove();
      this.#canvas = null;
      this.#observer?.disconnect();
      this.#observer = null;
    }
    super.remove();
  }

  /** @inheritdoc */
  rebuild() {
    super.rebuild();
    if (this.div === null) {
      return;
    }

    if (this.#bitmapId) {
      this.#getBitmap();
    }

    if (!this.isAttachedToDOM) {
      // At some point this editor was removed and we're rebuilting it,
      // hence we must add it to its parent.
      this.parent.add(this);
    }
  }

  /** @inheritdoc */
  onceAdded() {
    this.div.draggable = true;
    this.parent.addUndoableEditor(this);
    this.div.focus();
  }

  /** @inheritdoc */
  isEmpty() {
    return (
      this.#bitmapPromise === null &&
      this.#bitmap === null &&
      this.#bitmapUrl === null
    );
  }

  /** @inheritdoc */
  get isResizable() {
    return true;
  }

  /** @inheritdoc */
  render() {
    if (this.div) {
      return this.div;
    }

    let baseX, baseY;
    if (this.width) {
      baseX = this.x;
      baseY = this.y;
    }

    super.render();

    if (this.#bitmap) {
      this.#createCanvas();
    } else {
      this.div.classList.add("loading");
      this.#getBitmap();
    }

    if (this.width) {
      // This editor was created in using copy (ctrl+c).
      const [parentWidth, parentHeight] = this.parentDimensions;
      this.setAt(
        baseX * parentWidth,
        baseY * parentHeight,
        this.width * parentWidth,
        this.height * parentHeight
      );
    }

    return this.div;
  }

  #createCanvas() {
    const { div } = this;
    let { width, height } = this.#bitmap;
    const [pageWidth, pageHeight] = this.pageDimensions;
    const MAX_RATIO = 0.75;
    if (this.width) {
      width = this.width * pageWidth;
      height = this.height * pageHeight;
    } else if (
      width > MAX_RATIO * pageWidth ||
      height > MAX_RATIO * pageHeight
    ) {
      // If the the image is too big compared to the page dimensions
      // (more than MAX_RATIO) then we scale it down.
      const factor = Math.min(
        (MAX_RATIO * pageWidth) / width,
        (MAX_RATIO * pageHeight) / height
      );
      width *= factor;
      height *= factor;
    }
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.setDims(
      (width * parentWidth) / pageWidth,
      (height * parentHeight) / pageHeight
    );

    const canvas = (this.#canvas = document.createElement("canvas"));
    div.append(canvas);
    this.#drawBitmap(width, height);
    this.#createObserver();
    div.classList.remove("loading");
  }

  /**
   * When the dimensions of the div change the inner canvas must
   * renew its dimensions, hence it must redraw its own contents.
   * @param {number} width - the new width of the div
   * @param {number} height - the new height of the div
   * @returns
   */
  #setDimensions(width, height) {
    const [parentWidth, parentHeight] = this.parentDimensions;
    this.width = width / parentWidth;
    this.height = height / parentHeight;
    this.setDims(width, height);
    this.fixAndSetPosition();
    if (this.#resizeTimeoutId !== null) {
      clearTimeout(this.#resizeTimeoutId);
    }
    // When the user is resizing the editor we just use CSS to scale the image
    // to avoid redrawing it too often.
    // And once the user stops resizing the editor we redraw the image in
    // rescaling it correctly (see this.#scaleBitmap).
    const TIME_TO_WAIT = 200;
    this.#resizeTimeoutId = setTimeout(() => {
      this.#resizeTimeoutId = null;
      this.#drawBitmap(width, height);
    }, TIME_TO_WAIT);
  }

  #scaleBitmap(width, height) {
    const { width: bitmapWidth, height: bitmapHeight } = this.#bitmap;

    let newWidth = bitmapWidth;
    let newHeight = bitmapHeight;
    let bitmap = this.#bitmap;
    while (newWidth > 2 * width || newHeight > 2 * height) {
      const prevWidth = newWidth;
      const prevHeight = newHeight;

      if (newWidth > 2 * width) {
        // See bug 1820511 (Windows specific bug).
        // TODO: once the above bug is fixed we could revert to:
        // newWidth = Math.ceil(newWidth / 2);
        newWidth =
          newWidth >= 16384
            ? Math.floor(newWidth / 2) - 1
            : Math.ceil(newWidth / 2);
      }
      if (newHeight > 2 * height) {
        newHeight =
          newHeight >= 16384
            ? Math.floor(newHeight / 2) - 1
            : Math.ceil(newHeight / 2);
      }

      const offscreen = new OffscreenCanvas(newWidth, newHeight);
      const ctx = offscreen.getContext("2d");
      ctx.drawImage(
        bitmap,
        0,
        0,
        prevWidth,
        prevHeight,
        0,
        0,
        newWidth,
        newHeight
      );
      bitmap = offscreen.transferToImageBitmap();
    }

    return bitmap;
  }

  #drawBitmap(width, height) {
    const canvas = this.#canvas;
    if (!canvas || (canvas.width === width && canvas.height === height)) {
      return;
    }
    canvas.width = width;
    canvas.height = height;
    const bitmap = this.#isSvg
      ? this.#bitmap
      : this.#scaleBitmap(width, height);
    const ctx = canvas.getContext("2d");
    ctx.filter = this._uiManager.hcmFilter;
    ctx.drawImage(
      bitmap,
      0,
      0,
      bitmap.width,
      bitmap.height,
      0,
      0,
      width,
      height
    );
  }

  #serializeBitmap(toUrl) {
    if (toUrl) {
      if (this.#isSvg) {
        const url = this._uiManager.imageManager.getSvgUrl(this.#bitmapId);
        if (url) {
          return url;
        }
      }
      // We convert to a data url because it's sync and the url can live in the
      // clipboard.
      const canvas = document.createElement("canvas");
      ({ width: canvas.width, height: canvas.height } = this.#bitmap);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(this.#bitmap, 0, 0);

      return canvas.toDataURL();
    }

    if (this.#isSvg) {
      const [pageWidth, pageHeight] = this.pageDimensions;
      // Multiply by PixelsPerInch.PDF_TO_CSS_UNITS in order to increase the
      // image resolution when rasterizing it.
      const width = Math.round(
        this.width * pageWidth * PixelsPerInch.PDF_TO_CSS_UNITS
      );
      const height = Math.round(
        this.height * pageHeight * PixelsPerInch.PDF_TO_CSS_UNITS
      );
      const offscreen = new OffscreenCanvas(width, height);
      const ctx = offscreen.getContext("2d");
      ctx.drawImage(
        this.#bitmap,
        0,
        0,
        this.#bitmap.width,
        this.#bitmap.height,
        0,
        0,
        width,
        height
      );
      return offscreen.transferToImageBitmap();
    }

    return structuredClone(this.#bitmap);
  }

  /**
   * Create the resize observer.
   */
  #createObserver() {
    this.#observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      if (rect.width && rect.height) {
        this.#setDimensions(rect.width, rect.height);
      }
    });
    this.#observer.observe(this.div);
  }

  /** @inheritdoc */
  static deserialize(data, parent, uiManager) {
    if (data instanceof StampAnnotationElement) {
      return null;
    }
    const editor = super.deserialize(data, parent, uiManager);
    const { rect, bitmapUrl, bitmapId, isSvg } = data;
    if (bitmapId && uiManager.imageManager.isValidId(bitmapId)) {
      editor.#bitmapId = bitmapId;
    } else {
      editor.#bitmapUrl = bitmapUrl;
    }
    editor.#isSvg = isSvg;

    const [parentWidth, parentHeight] = editor.pageDimensions;
    editor.width = (rect[2] - rect[0]) / parentWidth;
    editor.height = (rect[3] - rect[1]) / parentHeight;

    return editor;
  }

  /** @inheritdoc */
  serialize(isForCopying = false, context = null) {
    if (this.isEmpty()) {
      return null;
    }

    const serialized = {
      annotationType: AnnotationEditorType.STAMP,
      bitmapId: this.#bitmapId,
      pageIndex: this.pageIndex,
      rect: this.getRect(0, 0),
      rotation: this.rotation,
      isSvg: this.#isSvg,
    };

    if (isForCopying) {
      // We don't know what's the final destination (this pdf or another one)
      // of this annotation and the clipboard doesn't support ImageBitmaps,
      // hence we serialize the bitmap to a data url.
      serialized.bitmapUrl = this.#serializeBitmap(/* toUrl = */ true);
      return serialized;
    }

    if (context === null) {
      return serialized;
    }

    context.stamps ||= new Map();
    const area = this.#isSvg
      ? (serialized.rect[2] - serialized.rect[0]) *
        (serialized.rect[3] - serialized.rect[1])
      : null;
    if (!context.stamps.has(this.#bitmapId)) {
      // We don't want to have multiple copies of the same bitmap in the
      // annotationMap, hence we only add the bitmap the first time we meet it.
      context.stamps.set(this.#bitmapId, { area, serialized });
      serialized.bitmap = this.#serializeBitmap(/* toUrl = */ false);
    } else if (this.#isSvg) {
      // If we have multiple copies of the same svg but with different sizes,
      // then we want to keep the biggest one.
      const prevData = context.stamps.get(this.#bitmapId);
      if (area > prevData.area) {
        prevData.area = area;
        prevData.serialized.bitmap.close();
        prevData.serialized.bitmap = this.#serializeBitmap(/* toUrl = */ false);
      }
    }
    return serialized;
  }
}

export { StampEditor };

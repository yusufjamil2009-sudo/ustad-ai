type PdfTextItem = { str?: string; hasEOL?: boolean };

export type ExtractedPdfText = {
  pages: string[];
  text: string;
  pageCount: number;
};

/** Extract selectable text without loading a browser worker or rendering canvas. */
export async function extractPdfText(bytes: Uint8Array): Promise<ExtractedPdfText> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: false,
    isEvalSupported: false,
  });
  const document = await loadingTask.promise;

  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => {
          const textItem = item as PdfTextItem;
          return `${textItem.str ?? ""}${textItem.hasEOL ? "\n" : " "}`;
        })
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim();
      pages.push(text);
      page.cleanup();
    }

    return {
      pages,
      text: pages.map((page, index) => `Page ${index + 1}\n${page}`).join("\n\n"),
      pageCount: document.numPages,
    };
  } finally {
    await document.destroy();
  }
}
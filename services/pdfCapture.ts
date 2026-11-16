import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface CapturePdfOptions {
    widthPx?: number;
    mode?: 'single-page' | 'blocks';
    contentWidthMm?: number;
    backgroundColor?: string;
}

const waitForRender = () =>
    new Promise<void>(resolve => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                setTimeout(resolve, 140);
            });
        });
    });

const fillPageBackground = (doc: jsPDF, bgHex: string) => {
    const r = parseInt(bgHex.slice(1, 3), 16);
    const g = parseInt(bgHex.slice(3, 5), 16);
    const b = parseInt(bgHex.slice(5, 7), 16);
    doc.setFillColor(r, g, b);
    doc.rect(0, 0, 210, 297, 'F');
};

const addTallCanvasSliced = (
    doc: jsPDF,
    canvas: HTMLCanvasElement,
    startX: number,
    startY: number,
    targetWidthMm: number,
    pageBottomY: number,
    topMargin: number,
    bgHex: string
): number => {
    const pxPerMm = canvas.width / targetWidthMm;
    let srcY = 0;
    let currentY = startY;

    while (srcY < canvas.height) {
        const availableMm = pageBottomY - currentY;
        if (availableMm < 20) {
            doc.addPage();
            fillPageBackground(doc, bgHex);
            currentY = topMargin;
            continue;
        }

        const sliceHeightPx = Math.min(canvas.height - srcY, Math.floor(availableMm * pxPerMm));
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = bgHex;
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(canvas, 0, srcY, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
        }

        const sliceHeightMm = sliceHeightPx / pxPerMm;
        const imgData = sliceCanvas.toDataURL('image/jpeg', 0.9);
        doc.addImage(imgData, 'JPEG', startX, currentY, targetWidthMm, sliceHeightMm);

        srcY += sliceHeightPx;
        currentY += sliceHeightMm;

        if (srcY < canvas.height) {
            doc.addPage();
            fillPageBackground(doc, bgHex);
            currentY = topMargin;
        }
    }

    return currentY;
};

export const renderReactToPdfBase64 = async (
    element: React.ReactElement,
    options: CapturePdfOptions = {}
): Promise<string> => {
    const {
        widthPx = 540,
        mode = 'blocks',
        contentWidthMm = 180,
        backgroundColor = '#f8fafc'
    } = options;

    const host = document.createElement('div');
    host.style.position = 'fixed';
    host.style.left = '-12000px';
    host.style.top = '0';
    host.style.width = `${widthPx}px`;
    host.style.backgroundColor = backgroundColor;
    host.style.padding = '16px';
    host.style.boxSizing = 'border-box';
    host.style.zIndex = '-9999';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);

    const root = createRoot(host);

    try {
        root.render(element);
        await waitForRender();

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidthMm = 210;
        const topMargin = 10;
        const bottomMargin = 10;
        const pageBottomY = 297 - bottomMargin;
        const maxPageHeightMm = pageBottomY - topMargin;

        fillPageBackground(doc, backgroundColor);

        if (mode === 'single-page') {
            const canvas = await html2canvas(host, {
                scale: 2,
                backgroundColor,
                useCORS: true,
                logging: false
            });

            let drawWidthMm = contentWidthMm;
            let drawHeightMm = (canvas.height * drawWidthMm) / canvas.width;

            if (drawHeightMm > maxPageHeightMm) {
                const ratio = maxPageHeightMm / drawHeightMm;
                drawHeightMm = maxPageHeightMm;
                drawWidthMm = drawWidthMm * ratio;
            }

            const x = (pageWidthMm - drawWidthMm) / 2;
            const imgData = canvas.toDataURL('image/jpeg', 0.92);
            doc.addImage(imgData, 'JPEG', x, topMargin, drawWidthMm, drawHeightMm);
        } else {
            const blocks = Array.from(host.querySelectorAll<HTMLElement>('[data-pdf-block="true"]'));
            const targets = blocks.length > 0 ? blocks : [host];
            const x = (pageWidthMm - contentWidthMm) / 2;
            let currentY = topMargin;

            for (const block of targets) {
                const canvas = await html2canvas(block, {
                    scale: 2,
                    backgroundColor,
                    useCORS: true,
                    logging: false
                });

                const imgHeightMm = (canvas.height * contentWidthMm) / canvas.width;

                if (imgHeightMm > maxPageHeightMm) {
                    if (currentY > topMargin + 5) {
                        doc.addPage();
                        fillPageBackground(doc, backgroundColor);
                        currentY = topMargin;
                    }
                    currentY = addTallCanvasSliced(
                        doc,
                        canvas,
                        x,
                        currentY,
                        contentWidthMm,
                        pageBottomY,
                        topMargin,
                        backgroundColor
                    );
                    currentY += 3;
                } else {
                    if (currentY + imgHeightMm > pageBottomY && currentY > topMargin) {
                        doc.addPage();
                        fillPageBackground(doc, backgroundColor);
                        currentY = topMargin;
                    }

                    const imgData = canvas.toDataURL('image/jpeg', 0.9);
                    doc.addImage(imgData, 'JPEG', x, currentY, contentWidthMm, imgHeightMm);
                    currentY += imgHeightMm + 3;
                }
            }
        }

        return doc.output('datauristring').split(',')[1];
    } finally {
        root.unmount();
        if (host.parentNode) {
            host.parentNode.removeChild(host);
        }
    }
};

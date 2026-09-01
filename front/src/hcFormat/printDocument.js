/** Imprime un HTML en un iframe oculto (evita la página en blanco de window.open + print inmediato). */
export function printHtmlDocument(html, options = {}) {
  const revokeUrls = [...(options.revokeUrls ?? [])];
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.setAttribute('title', 'Impresión');
    iframe.setAttribute('aria-hidden', 'true');
    Object.assign(iframe.style, {
      position: 'fixed',
      right: '0',
      bottom: '0',
      width: '830px',
      height: '1100px',
      border: '0',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
    });

    const wrapperBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const wrapperUrl = URL.createObjectURL(wrapperBlob);
    revokeUrls.push(wrapperUrl);

    let finished = false;
    let started = false;
    const finish = (ok) => {
      if (finished) return;
      finished = true;
      iframe.remove();
      for (const url of revokeUrls) {
        try {
          URL.revokeObjectURL(url);
        } catch {
          /* ignore */
        }
      }
      resolve(ok);
    };

    function hasPrintableContent(doc) {
      if (!doc?.body) return false;
      if (doc.body.innerText?.trim()) return true;
      if (doc.querySelector('input, textarea, select, .formato-body, .hc-formato-host')) {
        return true;
      }
      return false;
    }

    function waitForImages(doc) {
      const imgs = [...(doc?.querySelectorAll('img') ?? [])];
      if (!imgs.length) return Promise.resolve();
      return Promise.all(
        imgs.map(
          (img) =>
            new Promise((done) => {
              if (img.complete) {
                done();
                return;
              }
              img.addEventListener('load', () => done(), { once: true });
              img.addEventListener('error', () => done(), { once: true });
              window.setTimeout(() => done(), 4000);
            }),
        ),
      );
    }

    function tryStartPrint() {
      if (started || finished) return;
      const win = iframe.contentWindow;
      const doc = iframe.contentDocument;
      if (!win || !hasPrintableContent(doc)) {
        return;
      }
      started = true;
      void waitForImages(doc).then(() => {
        if (finished) return;
        const onAfterPrint = () => {
          win.removeEventListener('afterprint', onAfterPrint);
          finish(true);
        };
        win.addEventListener('afterprint', onAfterPrint);
        window.setTimeout(() => {
          try {
            win.focus();
            win.print();
          } catch {
            finish(false);
          }
        }, 250);
        window.setTimeout(() => finish(true), 120000);
      });
    }

    iframe.addEventListener('load', () => {
      tryStartPrint();
    });

    iframe.src = wrapperUrl;
    document.body.appendChild(iframe);
    window.setTimeout(() => {
      tryStartPrint();
    }, 400);
    window.setTimeout(() => {
      if (!started) finish(false);
    }, 20000);
  });
}

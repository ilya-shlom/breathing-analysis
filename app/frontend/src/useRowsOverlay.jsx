// useRowsOverlay.js
import { useState } from 'react';

export default function useRowsOverlay() {
  const [isOpen, setIsOpen]     = useState(false);
  const [draftRows, setDraft]   = useState([]);
  const [commitRows, setCommit] = useState(() => () => {});

  /** Call this to pop the overlay.
   *  @param {string[]} rows
   *  @param {(rows:string[])=>void} onSave */
  function open(rows, onSave) {
    setDraft(rows);
    setCommit(() => onSave);
    setIsOpen(true);
  }

  /**
   * Update a row.
   * For string rows we simply replace the whole value.
   * For object rows we patch the specific key.
   *
   * @param {number} idx                 row index
   * @param {string} keyOrValue          key (for objects) or new value (for strings)
   * @param {string=} maybeValue         new value when editing objects
   */
  const changeRow = (idx, keyOrValue, maybeValue) =>
    setDraft(r =>
      r.map((row, i) => {
        if (i !== idx) return row;

        // ► string rows
        if (typeof row === 'string') {
          return keyOrValue; // here keyOrValue is actually the new value
        }

        // ► object rows
        const key = keyOrValue;
        const value = maybeValue;
        return { ...row, [key]: value };
      })
    );

  const saveAndClose = () => {
    commitRows(draftRows);
    setIsOpen(false);
  };

  const Overlay = () =>
    !isOpen ? null : (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 overflow-y-auto">
        <div className="w-full rounded-lg bg-white p-8 mx-3 shadow-xl flex flex-col">
          <h2 className="mb-4 text-xl font-semibold">Edit rows</h2>

          {draftRows.map((row, i) =>
            typeof row === 'string' ? (
              /* ── string row ─────────────────────────────── */
              <input
                key={i}
                value={row}
                onChange={e => changeRow(i, e.target.value)}
                className="mb-3 w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            ) : (
              /* ── object row: render one input per field ─── */
              <div key={i} className="mb-4 rounded border border-gray-200 p-3 flex flex-row gap-5">
                {Object.entries(row).map(([key, val]) => (
                  <div key={key} className="mb-2">
                    <label className="mb-1 block text-xs font-medium capitalize">
                      {key}
                    </label>
                    <input
                      value={val ?? ''}
                      onChange={e => changeRow(i, key, e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ))}
              </div>
            )
          )}

          <button
            onClick={() =>
              setDraft(r => {
                /* if rows are strings → add empty string */
                if (r.length === 0 || typeof r[0] === 'string') return [...r, ''];

                /* rows are objects → clone keys with empty values */
                const template = r[0];
                const emptyObj = Object.fromEntries(
                  Object.keys(template).map(k => [k, ''])
                );
                return [...r, emptyObj];
              })
            }
            className="mb-4 rounded bg-gray-100 px-3 py-1 text-sm hover:bg-gray-200"
          >
            + Add row
          </button>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsOpen(false)}
              className="rounded bg-gray-100 px-4 py-2 text-sm hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={saveAndClose}
              className="rounded bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    );

  return [{ open }, Overlay];
}
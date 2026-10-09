// Read existing stores without creating, upgrading, writing, or restoring a DB.
// Missing-history probes can appear as version 0 in WebKit's databases() list;
// that inventory entry is not a reason to omit the actual V1 durable records.
export async function readNativeIndexedDb(page, name) {
  return page.evaluate(async name => {
    const inventory = await indexedDB.databases();
    const database = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name);
      request.onupgradeneeded = () => request.transaction.abort();
      request.onerror = () => reject(new Error(String(request.error)));
      request.onblocked = () => reject(new Error('Read-only evidence database is blocked'));
      request.onsuccess = () => {
        const db = request.result;
        const names = [...db.objectStoreNames];
        const result = {name: db.name, version: db.version, stores: {}};
        if (!names.length) { db.close(); resolve(result); return; }
        const tx = db.transaction(names, 'readonly');
        tx.onerror = () => { db.close(); reject(new Error(String(tx.error))); };
        tx.onabort = () => { db.close(); reject(new Error(String(tx.error))); };
        tx.oncomplete = () => { db.close(); resolve(result); };
        for (const storeName of names) {
          const store = tx.objectStore(storeName), values = store.getAll(), keys = store.getAllKeys();
          const rows = {keys: null, values: null};
          const join = () => { if (rows.keys && rows.values) result.stores[storeName] = rows.keys.map((key, i) => ({key, value: rows.values[i]})); };
          values.onsuccess = () => { rows.values = values.result; join(); };
          keys.onsuccess = () => { rows.keys = keys.result; join(); };
        }
      };
    });
    return {inventory, database};
  }, name);
}

let wasmMem: WebAssembly.Memory;
let wasmExports: any;

const workerCallables: Record<string, Function> = {};
const wasmCallbacks: Record<number, Function> = {};

console.log('Worker hello');

let confirmWasm: Function | null = null;
let awaitWasm: Promise<any> | null = new Promise(resolve => (confirmWasm = resolve));
self.onmessage = async (e: MessageEvent<any>) => {
    if (awaitWasm !== null) await awaitWasm;
    const result = await workerCallables[e.data.op](...(e.data.args ?? []));
    if (e.data.id !== undefined) {
        self.postMessage({ id: e.data.id, result });
    }
};

const importObject: WebAssembly.Imports = {
    env: {
        console_log(ptr: number, len: number) {
            const decoder = new TextDecoder('utf-8');
            console.log('[WASM]:', decoder.decode(new Uint8Array(wasmMem.buffer, ptr, len)));
        },
        request_write(callbackId: number, ptr: number) {
            wasmCallbacks[callbackId](ptr);
            delete wasmCallbacks[callbackId];
        },
        request_read(callbackId: number, ptr: number, len: number) {
            wasmCallbacks[callbackId](ptr, len);
            delete wasmCallbacks[callbackId];
        }
    }
};

(async () => {
    const wasmBytes = await (
        await fetch(new URL('../assets/givegif_wasm.wasm', import.meta.url))
    ).arrayBuffer();
    const wasmModule = new WebAssembly.Module(wasmBytes);
    const instance = await WebAssembly.instantiate(wasmModule, importObject);
    wasmMem = instance.exports.memory as WebAssembly.Memory;
    wasmExports = instance.exports as any;
    confirmWasm!();
    awaitWasm = null;
    console.log('WASM module loaed with exports', wasmExports);
})();

const generateCallbackId = () => Math.floor(Math.random() * 2 ** 31);

workerCallables.convertImage = async (imageData: ArrayBuffer, fileName: string) => {
    const writeId = generateCallbackId();
    const readId = generateCallbackId();
    wasmCallbacks[writeId] = (ptr: number) => {
        new Uint8Array(wasmMem.buffer).set(new Uint8Array(imageData), ptr);
    };
    let file: File;
    wasmCallbacks[readId] = (ptr: number, len: number) => {
        const gifBytes = new Uint8Array(wasmMem.buffer, ptr, len);
        file = new File([gifBytes], fileName, { type: 'image/gif' });
    };
    const success = wasmExports.image_to_gif(imageData.byteLength, writeId, readId);
    if (success !== 0) return null;

    const url = URL.createObjectURL(file!);
    console.log('Generated image URL', url);

    return url;
};

const worker = new Worker(new URL('convertWorker.ts', import.meta.url), { type: 'module' });
const workerCalls = {};

worker.onmessage = e => {
    workerCalls[e.data.id](e.data.result);
    delete workerCalls[e.data.id];
};

const callWorkerWithReturn = (op: string, ...args: any[]): Promise<any> => {
    const callId = Math.random().toString().substring(2);
    const prom = new Promise((resolve, reject) => {
        workerCalls[callId] = resolve;
    });
    worker.postMessage({ op, args, id: callId });
    return prom;
};

document.addEventListener('DOMContentLoaded', () => {
    const imageInput = document.getElementById('image_input') as HTMLInputElement;
    if (imageInput.files![0] !== undefined) onImageInputChange();
    imageInput.addEventListener('input', onImageInputChange);
});

const downloadURI = (uri: string, name: string) => {
    var link = document.createElement('a');
    link.download = name;
    link.href = uri;
    link.click();
};

const onImageInputChange = async () => {
    document.getElementById('input_div')?.classList.add('hide');
    document.getElementById('loading_div')?.classList.remove('hide');

    const file = (document.getElementById('image_input') as HTMLInputElement).files![0];

    const fileExtensions: Record<string, string[]> = {
        'image/png': ['png'],
        'image/jpeg': ['jpg', 'jpeg'],
        'image/webp': ['webp']
    };
    const fileNameSegs = file.name.split('.');
    if (fileExtensions[file.type].includes(fileNameSegs[fileNameSegs.length - 1]))
        fileNameSegs.pop();
    fileNameSegs.push('gif');
    const fileName = fileNameSegs.join('.');
    console.log('Gif filename will be ' + fileName);

    const callTime = Date.now();
    const gifUrl = await callWorkerWithReturn('convertImage', await file.arrayBuffer(), fileName);
    console.log('Worker call took', (Date.now() - callTime) / 1000, 'seconds to complete');
    const imageOutDiv = document.getElementById('image_output') as HTMLImageElement;
    if (gifUrl === null) {
        imageOutDiv.innerText = 'something went wrong while converting that image :(';
    } else {
        const imageEl = document.createElement('img');
        imageEl.src = gifUrl;
        imageOutDiv.setAttribute('image_file_name', fileName);
        imageOutDiv.innerHTML = `here\'s the gif. <a href="${gifUrl}" download>save</a>`;
        imageOutDiv.appendChild(imageEl);
    }
    document.getElementById('input_div')!.classList.remove('hide');
    document.getElementById('loading_div')!.classList.add('hide');
};

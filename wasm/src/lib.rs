#![feature(new_uninit)]

use std::mem::MaybeUninit;

mod js_functions {
    use std::mem::MaybeUninit;

    extern "C" {
        pub fn console_log(ptr: *const u8, len: usize);
        pub fn request_write(callback_id: usize, ptr: *mut MaybeUninit<u8>);
        pub fn request_read(callback_id: usize, ptr: *const u8, len: usize);
    }
}
fn console_log(s: &str) {
    unsafe { js_functions::console_log(s.as_ptr(), s.len()) }
}

#[no_mangle]
pub extern "C" fn allocate(len: usize) -> *mut MaybeUninit<u8> {
    let raw = Box::into_raw(Box::<[u8]>::new_uninit_slice(len));
    raw as *mut MaybeUninit<u8>
}

#[no_mangle]
pub extern "C" fn deallocate(ptr: *mut MaybeUninit<u8>, len: usize) {
    let slice = unsafe { std::slice::from_raw_parts_mut(ptr, len) };
    let slice = slice as *mut [MaybeUninit<u8>];
    let _ = unsafe { Box::from_raw(slice) };
}

#[no_mangle]
pub extern "C" fn image_to_gif(len: usize, write_id: usize, read_id: usize) -> isize {
    console_log(&format!(
        "image_to_gif called with len {}, write_id {}, read_id {}",
        len, write_id, read_id
    ));

    let mut boxed_slice = Box::new_uninit_slice(len);
    let boxed_slice = unsafe {
        js_functions::request_write(write_id, boxed_slice.as_mut_ptr());
        boxed_slice.assume_init()
    };
    let im = match image::load_from_memory(&boxed_slice) {
        Ok(v) => v,
        Err(e) => {
            console_log(&format!("Image load error: {}", &e.to_string()));
            return -1;
        }
    };

    let mut out = Vec::<u8>::new();
    let mut cursor = std::io::Cursor::new(&mut out);
    console_log("Starting write of gif");
    if let Err(e) = im.write_to(&mut cursor, image::ImageFormat::Gif) {
        console_log(&format!("Image write error: {}", &e.to_string()));
        return -1;
    };
    let outlen = out.len();
    let outptr = out.as_ptr();

    console_log(&format!(
        "Wrote gif to memory, {} bytes at {:?}",
        outlen, outptr
    ));

    unsafe { js_functions::request_read(read_id, outptr, outlen) };
    0
}

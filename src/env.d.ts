/// <reference types="vite/client" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module 'utif' {
  export function encodeImage(rgba: Uint8Array | Uint8ClampedArray, w: number, h: number, metadata?: any): ArrayBuffer;
  export function encode(ifds: any[]): ArrayBuffer;
}

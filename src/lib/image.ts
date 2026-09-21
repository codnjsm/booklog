/**
 * 사진 파일을 캔버스로 리사이즈해 JPEG base64로 변환한다(데이터 URI 접두어 제외).
 * iOS 사진(HEIC 포함)도 <img>로 그리면 브라우저가 알아서 디코딩해준다.
 * OCR 전송 크기를 줄이는 목적 + Cloud Vision이 HEIC를 못 받으므로 JPEG로 변환하는 목적을 겸한다.
 */
export function fileToResizedBase64(file: File, maxDim = 1600): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) {
        reject(new Error('캔버스를 생성하지 못했어요'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      resolve(dataUrl.slice(dataUrl.indexOf(',') + 1))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 불러오지 못했어요'))
    }
    img.src = url
  })
}

/** 파일을 <img>로 읽어들인다. 다 쓰고 나면 revoke()를 불러 URL을 풀어줘야 한다. */
export function loadImage(file: File): Promise<{ img: HTMLImageElement; revoke: () => void }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    const revoke = () => URL.revokeObjectURL(url)
    img.onload = () => resolve({ img, revoke })
    img.onerror = () => {
      revoke()
      reject(new Error('이미지를 불러오지 못했어요'))
    }
    img.src = url
  })
}

/**
 * 프로필 사진용. 원본에서 지정한 정사각 영역을 잘라 size×size 데이터 URI로 만든다.
 * Firestore 문서에 그대로 넣으므로(문서 한도 1MB) 작게 유지하는 게 중요하다 — 128px JPEG면 보통 10KB 안쪽.
 */
export function cropToAvatar(img: HTMLImageElement, area: { sx: number; sy: number; size: number }, out = 128): string {
  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('캔버스를 생성하지 못했어요')
  ctx.drawImage(img, area.sx, area.sy, area.size, area.size, 0, 0, out, out)
  return canvas.toDataURL('image/jpeg', 0.8)
}

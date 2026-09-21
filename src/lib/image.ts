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

/**
 * 프로필 사진용. 가운데를 정사각으로 잘라 size×size로 줄인 뒤 데이터 URI를 통째로 돌려준다.
 * Firestore 문서에 그대로 넣으므로(문서 한도 1MB) 작게 유지하는 게 중요하다 — 128px JPEG면 보통 10KB 안쪽.
 */
export function fileToSquareAvatar(file: File, size = 128): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const sx = (img.width - side) / 2
      const sy = (img.height - side) / 2
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) {
        reject(new Error('캔버스를 생성하지 못했어요'))
        return
      }
      ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)
      resolve(canvas.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('이미지를 불러오지 못했어요'))
    }
    img.src = url
  })
}

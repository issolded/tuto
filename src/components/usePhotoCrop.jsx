import { useState } from 'react'
import PhotoCrop from './PhotoCrop'

// Every screen wires this the same way: the file input hands its photo here instead of
// straight to whatever consumes it, and `cropNode` is rendered somewhere in the tree.
//
// Retake re-opens the picker synchronously, inside the same click. iOS only lets a file input
// be opened from a real user gesture, and a setTimeout — however short — is no longer that
// gesture, so the camera would silently not open.
export function usePhotoCrop({ translate, onReady, inputRef, accent }) {
  const [pending, setPending] = useState(null)
  const cropNode = pending ? (
    <PhotoCrop
      file={pending}
      translate={translate}
      accent={accent}
      onDone={blob => { setPending(null); onReady(blob) }}
      onRetake={() => { setPending(null); inputRef?.current?.click() }}
      onCancel={() => setPending(null)}
    />
  ) : null
  return { offerPhoto: setPending, cropNode }
}

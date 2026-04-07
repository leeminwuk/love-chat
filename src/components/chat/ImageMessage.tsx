'use client'

import { useState } from 'react'

type ImageMessageProps = {
  url: string
}

export default function ImageMessage({ url }: ImageMessageProps) {
  const [lightbox, setLightbox] = useState(false)
  const filename = url.split('/').pop() ?? 'image'

  return (
    <>
      <div
        className="inline-block border border-terminal-border rounded p-2 cursor-pointer hover:border-terminal-green transition-colors"
        onClick={() => setLightbox(true)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={filename}
          className="max-w-[200px] max-h-[150px] object-cover rounded"
        />
        <div className="text-terminal-dim text-[10px] mt-1 truncate max-w-[200px]">
          {filename}
        </div>
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={filename}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded"
          />
        </div>
      )}
    </>
  )
}

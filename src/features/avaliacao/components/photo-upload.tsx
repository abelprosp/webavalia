import { useCallback, useRef, useState } from 'react'
import { ImagePlus, X, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  ACCEPTED_TYPES,
  MAX_PHOTOS,
  MAX_SIZE_MB,
  MAX_TOTAL_MB,
  validatePhotoFiles,
} from '@/lib/photo-validation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export type EvaluationPhoto = {
  id: string
  file: File
  previewUrl: string
}

type PhotoUploadProps = {
  photos: EvaluationPhoto[]
  onChange: (photos: EvaluationPhoto[]) => void
}

export function PhotoUpload({ photos, onChange }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const incoming = Array.from(files)
      const remaining = MAX_PHOTOS - photos.length

      if (remaining <= 0) {
        toast.error(`Máximo de ${MAX_PHOTOS} fotos atingido.`)
        return
      }

      const validPhotos: EvaluationPhoto[] = []

      for (const file of incoming) {
        if (validPhotos.length >= remaining) {
          toast.error(`Máximo de ${MAX_PHOTOS} fotos atingido.`)
          break
        }
        const error = validatePhotoFiles([...photos, ...validPhotos, { file }])
        if (error) {
          toast.error(`${file.name}: ${error}`)
          continue
        }

        validPhotos.push({
          id: crypto.randomUUID(),
          file,
          previewUrl: URL.createObjectURL(file),
        })
      }

      if (validPhotos.length > 0) {
        onChange([...photos, ...validPhotos])
      }
    },
    [photos, onChange]
  )

  function removePhoto(id: string) {
    const photo = photos.find((p) => p.id === id)
    if (photo) URL.revokeObjectURL(photo.previewUrl)
    onChange(photos.filter((p) => p.id !== id))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files)
    }
  }

  return (
    <div className='space-y-4'>
      <div
        role='button'
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            inputRef.current?.click()
          }
        }}
        aria-label='Adicionar fotos do imóvel'
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
        )}
      >
        <div className='flex size-12 items-center justify-center rounded-full bg-primary/10'>
          <Upload className='size-6 text-primary' />
        </div>
        <div className='text-center'>
          <p className='text-sm font-medium'>
            Arraste fotos aqui ou clique para selecionar
          </p>
          <p className='mt-1 text-xs text-muted-foreground'>
            JPG, PNG ou WebP · até {MAX_SIZE_MB}MB · máx. {MAX_PHOTOS} fotos ·{' '}
            {MAX_TOTAL_MB}MB no total
          </p>
        </div>
        <input
          ref={inputRef}
          type='file'
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          className='hidden'
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {photos.length > 0 && (
        <div className='space-y-2'>
          <p className='text-sm text-muted-foreground'>
            {photos.length} de {MAX_PHOTOS} fotos adicionadas
          </p>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-3'>
            {photos.map((photo) => (
              <div
                key={photo.id}
                className='group relative aspect-square overflow-hidden rounded-lg border bg-muted'
              >
                <img
                  src={photo.previewUrl}
                  alt={photo.file.name}
                  className='size-full object-cover'
                />
                <Button
                  type='button'
                  variant='destructive'
                  size='icon'
                  aria-label={`Remover foto ${photo.file.name}`}
                  className='absolute top-1.5 right-1.5 size-8'
                  onClick={(e) => {
                    e.stopPropagation()
                    removePhoto(photo.id)
                  }}
                >
                  <X className='size-3.5' />
                </Button>
                <div className='absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-xs text-white'>
                  {photo.file.name}
                </div>
              </div>
            ))}

            {photos.length < MAX_PHOTOS && (
              <button
                type='button'
                onClick={() => inputRef.current?.click()}
                className='flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-muted-foreground/25 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary'
              >
                <ImagePlus className='size-6' />
                <span className='text-xs'>Adicionar</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

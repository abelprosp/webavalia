import { FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

type CriteriaSliderProps = {
  label: string
  description: string
  value: number
  onChange: (value: number) => void
}

export function CriteriaSlider({
  label,
  description,
  value,
  onChange,
}: CriteriaSliderProps) {
  return (
    <FormItem>
      <div className='flex items-center justify-between'>
        <div>
          <FormLabel>{label}</FormLabel>
          <p className='text-xs text-muted-foreground'>{description}</p>
        </div>
        <span className='text-lg font-bold tabular-nums text-primary'>
          {value}/5
        </span>
      </div>
      <Input
        type='range'
        min={1}
        max={5}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className='cursor-pointer accent-primary'
      />
      <div className='flex justify-between text-xs text-muted-foreground'>
        <span>Baixo</span>
        <span>Excelente</span>
      </div>
    </FormItem>
  )
}

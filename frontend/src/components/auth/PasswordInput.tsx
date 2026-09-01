import { useState, type ComponentProps } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils.tsx'

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>

/** Поле пароля с доступным переключателем видимости. Состояние видимости локальное:
 * родитель по-прежнему владеет только значением поля и не хранит пароль дополнительно. */
export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div className="relative">
      <input type={isVisible ? 'text' : 'password'} className={cn(className, 'pr-11')} {...props} />
      <button
        type="button"
        aria-label={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
        aria-pressed={isVisible}
        title={isVisible ? 'Скрыть пароль' : 'Показать пароль'}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsVisible((current) => !current)}
        className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-current/55 transition-colors hover:bg-white/8 hover:text-current focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-cyan-400"
      >
        {isVisible ? <EyeOff aria-hidden className="h-4.5 w-4.5" /> : <Eye aria-hidden className="h-4.5 w-4.5" />}
      </button>
    </div>
  )
}

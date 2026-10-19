import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'

// Controles básicos (identidade monia): 26px de altura, raio de 8px, borda de 1px discreta.
// O botão principal é grafite (invertido no modo escuro), como na marca.

type ButtonVariant = 'default' | 'primary' | 'plain' | 'destructive'

const buttonVariants: Record<ButtonVariant, string> = {
  default: 'bg-control-bg shadow-control hover:bg-fill-quaternary active:bg-fill-tertiary',
  primary: 'bg-primary text-on-primary hover:opacity-90 active:opacity-80',
  plain: 'hover:bg-fill-quaternary active:bg-fill-tertiary',
  destructive: 'bg-control-bg text-expense shadow-control active:bg-fill-tertiary'
}

export function Button({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={`no-drag inline-flex h-[26px] items-center gap-1.5 rounded-control px-3 text-base font-medium transition-[background-color,opacity] disabled:opacity-40 ${buttonVariants[variant]} ${className}`}
      {...props}
    />
  )
}

/** Botão só com ícone, para toolbars. */
export function IconButton({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`no-drag inline-flex h-7 min-w-7 items-center justify-center gap-1 rounded-control px-1.5 text-label-secondary transition-colors hover:bg-fill-quaternary hover:text-label active:bg-fill-tertiary disabled:opacity-40 ${className}`}
      {...props}
    />
  )
}

export const TextField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { className = '', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      className={`no-drag h-[26px] rounded-control bg-control-bg px-2.5 text-base shadow-field outline-none placeholder:text-label-tertiary ${className}`}
      {...props}
    />
  )
})

/** Switch do macOS (checkbox por baixo, para acessibilidade e teclado). */
export function Switch({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label className="no-drag relative inline-flex cursor-default items-center">
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="h-[22px] w-[38px] rounded-full bg-fill-tertiary transition-colors peer-checked:bg-accent peer-focus-visible:outline peer-focus-visible:outline-[3px] peer-focus-visible:outline-[color-mix(in_srgb,var(--accent)_50%,transparent)]" />
      <span className="absolute left-[2px] top-[2px] size-[18px] rounded-full bg-white shadow-control transition-transform peer-checked:translate-x-4" />
    </label>
  )
}

export function Select({ className = '', ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`no-drag h-[26px] rounded-control bg-control-bg pl-2.5 pr-1 text-base shadow-field outline-none ${className}`}
      {...props}
    />
  )
}

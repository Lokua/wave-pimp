type Override<T, U> = Omit<T, keyof U> & U

type Props = Override<
  React.HTMLAttributes<HTMLSelectElement>,
  {
    value: string
    options: string[] | number[]
    onChange: (value: string) => void
  }
>

export default function Select({ value, options, onChange, ...rest }: Props) {
  return (
    <span className="select-wrapper">
      <select
        value={value}
        onChange={(e) => {
          onChange(e.currentTarget.value)
        }}
        {...rest}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </span>
  )
}

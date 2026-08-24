'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  id: string
  label: string
  lang: string
  value: string
  onChange: (value: string) => void
  onRandom: () => void
  placeholder: string
  randomLoading?: boolean
  disabled?: boolean
}

export function ArticleAutocomplete({
  id,
  label,
  lang,
  value,
  onChange,
  onRandom,
  placeholder,
  randomLoading = false,
  disabled = false,
}: Props) {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [searchedQuery, setSearchedQuery] = useState('')
  const skipNextSearch = useRef(false)
  const lastTypedValue = useRef(value)
  const listId = `${id}-suggestions`

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    if (value !== lastTypedValue.current) {
      lastTypedValue.current = value
      return
    }

    if (disabled) return

    const query = value.trim()
    if (query.length < 2) return

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      setSuggestions([])
      setActiveIndex(-1)
      setSearchedQuery(query)
      setLoading(true)
      setOpen(true)
      try {
        const response = await fetch(`/api/wiki/search/${lang}?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('search_failed')
        const data = await response.json()
        if (controller.signal.aborted) return
        const next = Array.isArray(data.suggestions)
          ? data.suggestions.filter((title: unknown): title is string => typeof title === 'string')
          : []
        setSuggestions(next)
        setActiveIndex(-1)
        setSearchedQuery(query)
      } catch {
        if (!controller.signal.aborted) {
          setSuggestions([])
          setSearchedQuery(query)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [disabled, lang, value])

  function select(title: string) {
    skipNextSearch.current = true
    onChange(title)
    setSuggestions([])
    setOpen(false)
    setActiveIndex(-1)
    setSearchedQuery('')
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' && visibleSuggestions.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => (current + 1) % visibleSuggestions.length)
    } else if (event.key === 'ArrowUp' && visibleSuggestions.length > 0) {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((current) => current <= 0 ? visibleSuggestions.length - 1 : current - 1)
    } else if (event.key === 'Enter' && open && activeIndex >= 0) {
      event.preventDefault()
      select(visibleSuggestions[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
      setActiveIndex(-1)
    }
  }

  const currentQuery = value.trim()
  const visibleSuggestions = currentQuery.length >= 2 && searchedQuery === currentQuery ? suggestions : []
  const expanded = !disabled && currentQuery.length >= 2 && open && searchedQuery === currentQuery
  const showEmpty = expanded && !loading && visibleSuggestions.length === 0

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__row">
        <div className="autocomplete">
          <input
            id={id}
            role="combobox"
            value={value}
            disabled={disabled}
            onChange={(event) => {
              lastTypedValue.current = event.target.value
              onChange(event.target.value)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => visibleSuggestions.length > 0 && setOpen(true)}
            onBlur={() => setOpen(false)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            aria-autocomplete="list"
            aria-haspopup="listbox"
            aria-controls={listId}
            aria-expanded={expanded}
            aria-activedescendant={activeIndex >= 0 ? `${id}-suggestion-${activeIndex}` : undefined}
            aria-busy={currentQuery.length >= 2 && loading}
          />

          {expanded && visibleSuggestions.length > 0 && (
            <ul className="autocomplete__list" id={listId} role="listbox">
              {visibleSuggestions.map((title, index) => (
                <li key={title} role="presentation">
                  <button
                    id={`${id}-suggestion-${index}`}
                    className="autocomplete__option"
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => select(title)}
                  >
                    {title}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {expanded && loading && <span className="autocomplete__status" role="status">Buscando…</span>}
          {showEmpty && <span className="autocomplete__status" role="status">Sin resultados</span>}
        </div>
        <button
          className="button button--secondary button--compact"
          type="button"
          onClick={onRandom}
          disabled={disabled || randomLoading}
        >
          {randomLoading ? 'Buscando…' : 'Aleatorio'}
        </button>
      </div>
    </div>
  )
}

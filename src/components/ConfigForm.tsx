import { For, createSignal, createEffect } from 'solid-js'
import YAML from 'yaml'

type Schema = Record<string, { type: string; default?: any; description?: string }>

export default function ConfigForm(props: { schema: Schema; variantName: string; onVariantNameChange: (s: string) => void }) {
  const keys = Object.keys(props.schema)
  const initial: Record<string, any> = {}
  keys.forEach(k => (initial[k] = props.schema[k].default ?? null))

  const [values, setValues] = createSignal(initial)
  const [showPreview, setShowPreview] = createSignal(true)

  // When schema changes, reset values to defaults
  createEffect(() => {
    const s = props.schema
    const defaults: Record<string, any> = {}
    Object.keys(s).forEach(k => (defaults[k] = s[k].default ?? null))
    setValues(defaults)
  })

  function update(key: string, v: any) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(values(), null, 2)], { type: 'application/json' })
    triggerDownload(blob, `${props.variantName || 'variant'}.json`)
  }

  function exportYAML() {
    const yaml = YAML.stringify(values())
    const blob = new Blob([yaml], { type: 'text/yaml' })
    triggerDownload(blob, `${props.variantName || 'variant'}.yaml`)
  }

function generateCHeader(): string {
  const v = values()
  const lines: string[] = []
  lines.push('#pragma once')
  lines.push('// Auto-generated header from Config Editor')
  
  // Escape variant name for safe HTML output
  const escapedVariantName = escapeHtml(props.variantName || 'variant')
  lines.push(`// Variant: ${escapedVariantName}`)
  lines.push('')
  
  lines.push('// Variant-specific defines (highest priority)')
  Object.keys(v).forEach(k => {
    // Validate C identifier
    if (!isValidCIdentifier(k)) {
      console.warn(`Skipping invalid C identifier: ${k}`)
      return
    }
    
    const schemaEntry = props.schema[k]
    if (!schemaEntry) {
      console.warn(`No schema found for key: ${k}`)
      return
    }
    
    const val = v[k]
    if (schemaEntry.type === 'boolean') {
      lines.push(`#define ${k} ${val ? 1 : 0}`)
    } else if (schemaEntry.type === 'string') {
      // Escape quotes and backslashes for C strings
      const escapedVal = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
      lines.push(`#define ${k} "${escapedVal}"`)
    } else {
      lines.push(`#define ${k} ${val}`)
    }
  })
  
  lines.push('')
  lines.push('// Common defaults (only applied if not defined by variant)')
  Object.keys(props.schema).forEach(k => {
    const schemaEntry = props.schema[k]
    if (!schemaEntry) return
    
    const def = schemaEntry.default
    // Allow falsy values as valid defaults
    if (def !== undefined) {
      if (!isValidCIdentifier(k)) return
      
      lines.push(`#ifndef ${k}`)
      if (schemaEntry.type === 'boolean') {
        lines.push(`#define ${k} ${def ? 1 : 0}`)
      } else if (schemaEntry.type === 'string') {
        const escapedDef = String(def).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
        lines.push(`#define ${k} "${escapedDef}"`)
      } else {
        lines.push(`#define ${k} ${def}`)
      }
      lines.push('#endif')
    }
  })
  
  const raw = lines.join('\n')
  
  // Apply syntax highlighting with proper HTML escaping
  return escapeHtml(raw)
    .replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>')
    .replace(/(#pragma|#define|#ifndef|#endif)/gm, '<span class="keyword">$1</span>')
    .replace(/&quot;([^&]*)&quot;/gm, '<span class="string">&quot;$1&quot;</span>')
    .replace(/\b(\d+)\b/gm, '<span class="number">$1</span>')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function isValidCIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)
}

  function exportCHeader() {
    const content = generateCHeader()
    const blob = new Blob([content], { type: 'text/x-c-header' })
    triggerDownload(blob, `${props.variantName || 'variant'}_final_cfg.h`)
  }

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div class="config-form">
      <div class="meta">
        <label>
          Variant name:
          <input type="text" value={props.variantName} onInput={e => props.onVariantNameChange((e.target as HTMLInputElement).value)} />
        </label>
        <label style="margin-left:1rem">
          <input type="checkbox" checked={showPreview()} onChange={e => setShowPreview((e.target as HTMLInputElement).checked)} /> Show C preview
        </label>
      </div>

      <div style="preview">
        <form onSubmit={e => e.preventDefault()} style="flex:1">
          <For each={Object.entries(props.schema)}>
            {([key, def]) => (
              <div class="field">
                <label for={key}>
                  <strong>{key}</strong>
                  <div class="desc">{def.description}</div>
                </label>

                {def.type === 'boolean' && (
                  <input
                    id={key}
                    type="checkbox"
                    checked={!!values()[key]}
                    onChange={e => update(key, (e.target as HTMLInputElement).checked)}
                  />
                )}

                {def.type === 'number' && (
                  <input
                    id={key}
                    type="number"
                    value={values()[key] ?? ''}
                    onInput={e => update(key, Number((e.target as HTMLInputElement).value))}
                  />
                )}

                {def.type === 'string' && (
                  <input
                    id={key}
                    type="text"
                    value={values()[key] ?? ''}
                    onInput={e => update(key, (e.target as HTMLInputElement).value)}
                  />
                )}
              </div>
            )}
          </For>

          <div class="actions">
            <button type="button" onClick={exportJSON}>Export JSON</button>
            <button type="button" onClick={exportYAML}>Export YAML</button>
            <button type="button" onClick={exportCHeader}>Export C header (.h)</button>
          </div>
        </form>

        {showPreview() && (
          <div style="width:600px; flex-shrink:0;">
            <h3>Generated C header preview</h3>
            <pre style="white-space:pre-wrap; background: #1e1e1e; padding:10px; border-radius:6px; height:520px; overflow:auto" innerHTML={generateCHeader()}/>
          </div>
        )}
      </div>
    </div>
  )
}
import { createSignal, createResource } from 'solid-js'
import ConfigForm from './components/ConfigForm'

const fetchSchema = async () => {
  const r = await fetch('/config_schema.json')
  return r.json()
}

export default function App() {
  const [schema] = createResource(fetchSchema)
  const [variantName, setVariantName] = createSignal('variant')

  return (
    <div class="app">
      <header>
        <h1>Config Editor</h1>
      </header>

      <main>
        {schema.loading && <div>Loading schema…</div>}
        {schema.error && <div>Error loading schema</div>}
        {schema() && (
          <ConfigForm schema={schema()} variantName={variantName()} onVariantNameChange={setVariantName} />
        )}
      </main>

      <footer>
        <small>Export YAML/JSON and drop into your firmware repo.</small>
      </footer>
    </div>
  )
}

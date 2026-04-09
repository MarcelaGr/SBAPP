import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

function App() {
  const [status, setStatus] = useState('Connecting...')

  useEffect(() => {
    async function testConnection() {
      const { data, error } = await supabase
        .from('associations')
        .select('*')

      if (error) {
        setStatus('Connection failed: ' + error.message)
      } else {
        setStatus('Connected! Found ' + data.length + ' associations: ' +
          data.map(a => a.short_name).join(', '))
      }
    }
    testConnection()
  }, [])

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Stone Busailah LLP</h1>
      <p>{status}</p>
    </div>
  )
}

export default App
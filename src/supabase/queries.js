import { supabase } from './client'

// Example: Fetch data from a table
export async function fetchData() {
  const { data, error } = await supabase
    .from('your_table')
    .select('*')
  
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Data:', data)
}

// Example: Insert data
export async function insertData(newItem) {
  const { data, error } = await supabase
    .from('your_table')
    .insert([newItem])
    
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log('Inserted:', data)
} 
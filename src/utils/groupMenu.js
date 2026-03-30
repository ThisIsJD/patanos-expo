export function groupMenu(items, categories) {
  const grouped = {}
  items.forEach(item => {
    const key = `${item.name}__${item.category_id}`
    if (!grouped[key]) {
      const cat = categories.find(c => c.id === item.category_id)
      grouped[key] = {
        name: item.name,
        category_id: item.category_id,
        category_name: cat?.name ?? '',
        image_url: item.image_url,
        description: item.description,
        variants: [],
      }
    }
    grouped[key].variants.push(item)
  })
  return Object.values(grouped)
}

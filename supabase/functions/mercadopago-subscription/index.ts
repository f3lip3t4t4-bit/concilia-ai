import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Cabeçalho de autorização ausente')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const { name, tax_id } = await req.json()
    if (!name || !tax_id) throw new Error('Nome e CPF/CNPJ são obrigatórios')

    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado no Supabase');
    }

    // 1. Criar/Buscar Customer no MP
    const customerResp = await fetch('https://api.mercadopago.com/v1/customers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: user.email, 
        first_name: name, 
        identification: { 
          type: tax_id.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF', 
          number: tax_id.replace(/\D/g, '') 
        } 
      })
    })
    
    let customer = await customerResp.json()
    let customerId = customer.id

    // Se o cliente já existir, buscamos pelo e-mail
    if (customerResp.status === 400 && customer.cause?.[0]?.code === "already_exists_customer") {
       const searchResp = await fetch(`https://api.mercadopago.com/v1/customers/search?email=${user.email}`, {
         headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
       })
       const searchData = await searchResp.json()
       customerId = searchData.results?.[0]?.id
    }

    if (!customerId) throw new Error('Erro ao processar cliente no Mercado Pago')

    // 2. Criar Assinatura (Pre-approval)
    const subBody = {
      reason: "Assinatura Concilia Pro",
      external_reference: user.id,
      payer_email: user.email,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: 49.90,
        currency_id: "BRL"
      },
      back_url: "https://klokjxcaeamgbfowmbqf.supabase.co", 
      status: "pending"
    }

    const subResp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(subBody)
    })
    const subscription = await subResp.json()

    if (subResp.status >= 400) {
      throw new Error(`Erro MP: ${subscription.message || 'Falha na assinatura'}`)
    }

    // 3. Salvar no Banco
    await supabaseClient.from('subscriptions').upsert({
      user_id: user.id,
      customer_id_mp: customerId,
      subscription_id_mp: subscription.id,
      status: 'pending'
    })

    return new Response(JSON.stringify({ init_point: subscription.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
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
    if (!authHeader) throw new Error('Unauthorized')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('User not found')

    const { plan, tax_id, name } = await req.json()
    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')

    console.log(`[mercadopago-subscription] Iniciando assinatura para ${user.email}`)

    // 1. Criar/Buscar Customer no MP
    const customerResp = await fetch('https://api.mercadopago.com/v1/customers', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: user.email, first_name: name, identification: { type: tax_id.length > 11 ? 'CNPJ' : 'CPF', number: tax_id } })
    })
    const customer = await customerResp.json()
    const customerId = customer.id

    // 2. Criar Assinatura (Pre-approval)
    // Nota: Em produção, você usaria um 'plan_id' pré-criado no painel do MP
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
      back_url: "https://klokjxcaeamgbfowmbqf.supabase.co", // URL do seu app
      status: "pending"
    }

    const subResp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(subBody)
    })
    const subscription = await subResp.json()

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
    console.error("[mercadopago-subscription] Erro:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: corsHeaders 
    })
  }
})
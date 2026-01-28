import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const functionName = "mercadopago-subscription";
  
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

    const body = await req.json()
    const { name, tax_id } = body
    
    console.log(`[${functionName}] Iniciando checkout para:`, { email: user.email, name });

    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    if (!MP_ACCESS_TOKEN) {
      console.error(`[${functionName}] Erro: MERCADO_PAGO_ACCESS_TOKEN não encontrado nos Secrets.`);
      throw new Error('Configuração pendente: Token do Mercado Pago não encontrado no Supabase.');
    }

    // 1. Criar/Buscar Customer no MP
    const cleanTaxId = tax_id.replace(/\D/g, '');
    const idType = cleanTaxId.length > 11 ? 'CNPJ' : 'CPF';

    console.log(`[${functionName}] Verificando/Criando cliente no MP...`);
    
    const customerResp = await fetch('https://api.mercadopago.com/v1/customers', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({ 
        email: user.email, 
        first_name: name, 
        identification: { 
          type: idType, 
          number: cleanTaxId 
        } 
      })
    })
    
    let customerData = await customerResp.json()
    let customerId = customerData.id

    if (customerResp.status === 400 && customerData.cause?.[0]?.code === "already_exists_customer") {
       console.log(`[${functionName}] Cliente já existe, buscando ID...`);
       const searchResp = await fetch(`https://api.mercadopago.com/v1/customers/search?email=${user.email}`, {
         headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
       })
       const searchResult = await searchResp.json()
       customerId = searchResult.results?.[0]?.id
    } else if (customerResp.status >= 400) {
      console.error(`[${functionName}] Erro ao criar cliente:`, customerData);
      throw new Error(`Mercado Pago (Cliente): ${customerData.message || 'Erro desconhecido'}`);
    }

    if (!customerId) throw new Error('Não foi possível identificar o cliente no Mercado Pago.');

    // 2. Criar Assinatura (Pre-approval)
    console.log(`[${functionName}] Gerando link de assinatura...`);
    
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
      // Usando uma URL genérica de retorno ou a própria URL do projeto
      back_url: "https://klokjxcaeamgbfowmbqf.supabase.co", 
      status: "pending"
    }

    const subResp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify(subBody)
    })
    
    const subscription = await subResp.json()

    if (subResp.status >= 400) {
      console.error(`[${functionName}] Erro ao criar assinatura:`, subscription);
      throw new Error(`Mercado Pago (Assinatura): ${subscription.message || 'Falha ao gerar link de pagamento'}`);
    }

    // 3. Salvar no Banco
    console.log(`[${functionName}] Salvando registro de assinatura pendente...`);
    await supabaseClient.from('subscriptions').upsert({
      user_id: user.id,
      customer_id_mp: customerId,
      subscription_id_mp: subscription.id,
      status: 'pending',
      updated_at: new Date().toISOString()
    })

    return new Response(JSON.stringify({ init_point: subscription.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error(`[mercadopago-subscription] ERRO CRÍTICO:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
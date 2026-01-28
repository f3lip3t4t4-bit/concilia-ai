import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const functionName = "mercadopago-subscription";

  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log(`[${functionName}] Requisição iniciada.`);

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error(`[${functionName}] Erro: Cabeçalho Authorization ausente.`);
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Validar usuário
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error(`[${functionName}] Erro ao validar usuário:`, userError);
      return new Response(JSON.stringify({ error: 'Sessão inválida' }), { status: 401, headers: corsHeaders });
    }

    console.log(`[${functionName}] Usuário validado: ${user.email}`);

    const body = await req.json().catch(() => ({}));
    const { name, tax_id } = body;

    if (!name || !tax_id) {
      console.error(`[${functionName}] Dados insuficientes no body.`);
      return new Response(JSON.stringify({ error: 'Nome e CPF/CNPJ são obrigatórios.' }), { status: 400, headers: corsHeaders });
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      console.error(`[${functionName}] Segredo MERCADO_PAGO_ACCESS_TOKEN não configurado.`);
      return new Response(JSON.stringify({ error: 'Configuração do servidor incompleta.' }), { status: 500, headers: corsHeaders });
    }

    // 1. Criar ou Buscar Cliente no MP
    const cleanTaxId = tax_id.replace(/\D/g, '');
    const idType = cleanTaxId.length > 11 ? 'CNPJ' : 'CPF';

    console.log(`[${functionName}] Sincronizando cliente no Mercado Pago...`);
    const customerResp = await fetch('https://api.mercadopago.com/v1/customers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: user.email,
        first_name: name,
        identification: { type: idType, number: cleanTaxId }
      })
    });

    let customerData = await customerResp.json();
    let customerId = customerData.id;

    if (customerResp.status === 400 && customerData.cause?.[0]?.code === "already_exists_customer") {
      console.log(`[${functionName}] Cliente já existe, buscando ID...`);
      const searchResp = await fetch(`https://api.mercadopago.com/v1/customers/search?email=${user.email}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      });
      const searchResult = await searchResp.json();
      customerId = searchResult.results?.[0]?.id;
    } else if (customerResp.status >= 400) {
      console.error(`[${functionName}] Erro na API de Customers do MP:`, customerData);
      return new Response(JSON.stringify({ error: `Mercado Pago: ${customerData.message || 'Erro ao criar cliente'}` }), { status: 400, headers: corsHeaders });
    }

    // 2. Criar Checkout de Assinatura
    console.log(`[${functionName}] Criando link de pagamento para o cliente ${customerId}`);
    const subBody = {
      reason: "Assinatura Mensal Concilia Pro",
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
    };

    const subResp = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(subBody)
    });

    const subscription = await subResp.json();

    if (subResp.status >= 400) {
      console.error(`[${functionName}] Erro na API de Preapproval do MP:`, subscription);
      return new Response(JSON.stringify({ error: `Mercado Pago: ${subscription.message || 'Falha ao gerar link'}` }), { status: 400, headers: corsHeaders });
    }

    // 3. Persistir no Supabase
    await supabaseClient.from('subscriptions').upsert({
      user_id: user.id,
      customer_id_mp: customerId,
      subscription_id_mp: subscription.id,
      status: 'pending',
      updated_at: new Date().toISOString()
    });

    console.log(`[${functionName}] Sucesso! Retornando init_point.`);
    return new Response(JSON.stringify({ init_point: subscription.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(`[${functionName}] Erro inesperado:`, err.message);
    return new Response(JSON.stringify({ error: 'Erro interno no servidor de pagamentos.' }), {
      status: 500,
      headers: corsHeaders
    });
  }
})
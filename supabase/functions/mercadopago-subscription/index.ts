import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const functionName = "mercadopago-subscription";

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log(`[${functionName}] Recebendo requisição de checkout...`);

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error(`[${functionName}] Erro: Autorização ausente`);
      throw new Error('Não autorizado');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', // Usando service role para bypass de RLS se necessário
    )

    // Pegar o usuário pelo token JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) {
      console.error(`[${functionName}] Erro ao validar usuário:`, authError);
      throw new Error('Usuário inválido');
    }

    const body = await req.json().catch(() => ({}));
    const { name, tax_id } = body;
    
    if (!name || !tax_id) {
      console.error(`[${functionName}] Erro: Dados incompletos`, { name, tax_id });
      throw new Error('Nome e CPF/CNPJ são obrigatórios para o Mercado Pago.');
    }

    const MP_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN')
    if (!MP_ACCESS_TOKEN) {
      console.error(`[${functionName}] Erro: Chave MERCADO_PAGO_ACCESS_TOKEN não encontrada nos Secrets.`);
      throw new Error('Configuração pendente: Token do Mercado Pago não encontrado no Supabase.');
    }

    console.log(`[${functionName}] Processando cliente:`, user.email);

    // 1. Criar/Buscar Customer no MP
    const cleanTaxId = tax_id.replace(/\D/g, '');
    const idType = cleanTaxId.length > 11 ? 'CNPJ' : 'CPF';

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
    })
    
    let customerData = await customerResp.json()
    let customerId = customerData.id

    if (customerResp.status === 400 && customerData.cause?.[0]?.code === "already_exists_customer") {
       console.log(`[${functionName}] Cliente já cadastrado, recuperando ID...`);
       const searchResp = await fetch(`https://api.mercadopago.com/v1/customers/search?email=${user.email}`, {
         headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
       })
       const searchResult = await searchResp.json()
       customerId = searchResult.results?.[0]?.id
    } else if (customerResp.status >= 400) {
      console.error(`[${functionName}] Erro na API de Clientes do MP:`, customerData);
      throw new Error(`Mercado Pago: ${customerData.message || 'Erro ao criar cliente'}`);
    }

    // 2. Criar Assinatura (Pre-approval)
    console.log(`[${functionName}] Gerando link de pagamento...`);
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
      back_url: "https://klokjxcaeamgbfowmbqf.supabase.co", // Substitua pela URL do seu app se tiver uma personalizada
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
      console.error(`[${functionName}] Erro na API de Assinaturas do MP:`, subscription);
      throw new Error(`Mercado Pago: ${subscription.message || 'Falha ao gerar checkout'}`);
    }

    // 3. Registrar no banco local
    await supabaseClient.from('subscriptions').upsert({
      user_id: user.id,
      customer_id_mp: customerId,
      subscription_id_mp: subscription.id,
      status: 'pending',
      updated_at: new Date().toISOString()
    })

    console.log(`[${functionName}] Checkout gerado com sucesso!`);

    return new Response(JSON.stringify({ init_point: subscription.init_point }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error(`[mercadopago-subscription] Erro Crítico:`, error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
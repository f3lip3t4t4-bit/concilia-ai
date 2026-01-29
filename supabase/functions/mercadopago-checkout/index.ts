import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  const functionName = "mercadopago-checkout";

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error(`[${functionName}] Erro: Cabeçalho de autorização ausente`);
      throw new Error('Não autorizado');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error(`[${functionName}] Erro ao validar usuário:`, userError);
      throw new Error('Sessão expirada ou inválida');
    }

    const body = await req.json().catch(() => ({}));
    const { name, tax_id, redirect_url } = body;

    if (!name || !tax_id) {
      throw new Error('Dados do pagador incompletos (nome e CPF/CNPJ são obrigatórios)');
    }

    console.log(`[${functionName}] Gerando checkout para: ${user.email} (${user.id})`);

    const MERCADO_PAGO_ACCESS_TOKEN = Deno.env.get('MERCADO_PAGO_ACCESS_TOKEN');
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      console.error(`[${functionName}] Erro: MERCADO_PAGO_ACCESS_TOKEN não configurado no Supabase`);
      throw new Error('Erro de configuração no servidor de pagamentos.');
    }

    const cleanTaxId = tax_id.replace(/\D/g, '');
    const idType = cleanTaxId.length > 11 ? 'CNPJ' : 'CPF';

    const preference = {
      items: [{
        id: "concilia-pro-mensal",
        title: "Concilia Pro – Acesso Mensal",
        quantity: 1,
        currency_id: "BRL",
        unit_price: 49.90,
        description: "Assinatura mensal para o sistema Concilia"
      }],
      payer: {
        name,
        email: user.email,
        identification: {
          type: idType,
          number: cleanTaxId
        }
      },
      back_urls: {
        success: `${redirect_url}/success`,
        failure: `${redirect_url}/checkout`,
        pending: `${redirect_url}/pending`
      },
      auto_return: "approved",
      external_reference: user.id 
    }

    const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    })

    const data = await response.json()

    if (!response.ok) {
      console.error(`[${functionName}] Erro na API do Mercado Pago:`, data);
      throw new Error(data.message || "O Mercado Pago recusou a criação do checkout.");
    }

    console.log(`[${functionName}] Preferência criada com sucesso: ${data.id}`);

    return new Response(JSON.stringify({
      init_point: data.init_point,
      preference_id: data.id
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error(`[${functionName}] Erro crítico:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
})
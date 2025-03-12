import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createCollectionsWorkflow,
} from "@medusajs/medusa/core-flows";
import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";

export default async function importCatalog({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);

  // Récupérer le sales channel par défaut
  logger.info("Récupération du sales channel par défaut...");
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    logger.error("Le sales channel par défaut n'existe pas. Veuillez d'abord exécuter le script de seed complet.");
    return;
  }

  // Récupérer le shipping profile par défaut
  logger.info("Récupération du shipping profile par défaut...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default"
  })
  
  if (!shippingProfiles.length) {
    logger.error("Aucun shipping profile par défaut trouvé. Veuillez d'abord exécuter le script de seed complet.");
    return;
  }
  
  const shippingProfile = shippingProfiles[0];

  // Création des catégories
  logger.info("Création des catégories de produits...");
  const { result: categoryResult } = await createProductCategoriesWorkflow(
    container
  ).run({
    input: {
      product_categories: [
        {
          name: "Clothing",
          is_active: true,
        },
        {
          name: "Audio",
          is_active: true,
        },
        {
          name: "Furniture",
          is_active: true,
        },
      ],
    },
  });

  // Récupération de la catégorie Clothing pour associer les sous-catégories
  const clothingCategory = categoryResult.find(cat => cat.name === "Clothing");

  // Création des sous-catégories pour Clothing
  await createProductCategoriesWorkflow(container).run({
    input: {
      product_categories: [
        {
          name: "Hoodies",
          is_active: true,
          parent_category_id: clothingCategory!.id,
        },
        {
          name: "Accessories",
          is_active: true,
          parent_category_id: clothingCategory!.id,
        },
      ],
    },
  });

  // Récupérer toutes les catégories pour les utiliser lors de la création des produits
  const { data: allCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "parent_category_id"],
  });

  // Création des collections
  logger.info("Création des collections de produits...");
  const { result: collectionsResult } = await createCollectionsWorkflow(container).run({
    input: {
      collections: [
        {
          title: "Latest Drops",
          handle: "latest-drops",
        },
        {
          title: "Weekly Picks",
          handle: "weekly-picks",
        },
        {
          title: "Sale",
          handle: "sale",
        },
      ],
    },
  });

  // Utiliser les collections créées
  const latestDrops = collectionsResult.find(c => c.title === "Latest Drops")!;
  const weeklyPicks = collectionsResult.find(c => c.title === "Weekly Picks")!;
  const saleCollection = collectionsResult.find(c => c.title === "Sale")!;

  // Création des produits
  logger.info("Création des produits...");
  await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "BlendMaster Elite Fusionator",
          category_ids: [
            allCategories.find((cat) => cat.name === "Furniture")!.id,
          ],
          collection_id: latestDrops.id,
          description: "Because ordinary blenders are for the common folk. With the BlendMaster, you can effortlessly mix your pretentious smoothies and soups while feeling like a culinary genius. It's not just a blender; it's a status symbol in the world of haute cuisine.",
          handle: "blendmaster-elite-fusionator",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Plug",
              values: ["EU", "US", "UK"],
            },
          ],
          variants: [
            {
              title: "EU",
              sku: "BLEND-EU",
              options: {
                Plug: "EU",
              },
              prices: [
                {
                  amount: 149.99,
                  currency_code: "eur",
                },
                {
                  amount: 169.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "US",
              sku: "BLEND-US",
              options: {
                Plug: "US",
              },
              prices: [
                {
                  amount: 159.99,
                  currency_code: "eur",
                },
                {
                  amount: 179.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "UK",
              sku: "BLEND-UK",
              options: {
                Plug: "UK",
              },
              prices: [
                {
                  amount: 165.99,
                  currency_code: "eur",
                },
                {
                  amount: 185.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        
        // Corporate Commando Throne
        {
          title: "Corporate Commando Throne",
          category_ids: [
            allCategories.find((cat) => cat.name === "Furniture")!.id,
          ],
          collection_id: latestDrops.id,
          description: "Experience the ultimate in ergonomic comfort and stylish design. Enhance productivity while commanding authority.",
          handle: "corporate-commando-throne",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Adjustability",
              values: ["Height", "Height + Tilt"],
            },
          ],
          variants: [
            {
              title: "Height",
              sku: "THRONE-H",
              options: {
                Adjustability: "Height",
              },
              prices: [
                {
                  amount: 299.99,
                  currency_code: "eur",
                },
                {
                  amount: 329.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Height + Tilt",
              sku: "THRONE-HT",
              options: {
                Adjustability: "Height + Tilt",
              },
              prices: [
                {
                  amount: 349.99,
                  currency_code: "eur",
                },
                {
                  amount: 379.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        
        // Decibel Dominator Deluxe
        {
          title: "Decibel Dominator Deluxe",
          category_ids: [
            allCategories.find((cat) => cat.name === "Audio")!.id,
          ],
          collection_id: weeklyPicks.id,
          description: "Introducing the mighty Decibel Dominator Deluxe clock radio alarm! Experience seamless Bluetooth connectivity and crystal-clear DAB+ radio. Rise and shine in style!",
          handle: "decibel-dominator-deluxe",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Color",
              values: ["Black", "White", "Yellow"],
            },
          ],
          variants: [
            {
              title: "Black",
              sku: "DDD-BLACK",
              options: {
                Color: "Black",
              },
              prices: [
                {
                  amount: 89.99,
                  currency_code: "eur",
                },
                {
                  amount: 99.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "White",
              sku: "DDD-WHITE",
              options: {
                Color: "White",
              },
              prices: [
                {
                  amount: 89.99,
                  currency_code: "eur",
                },
                {
                  amount: 99.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Yellow",
              sku: "DDD-YELLOW",
              options: {
                Color: "Yellow",
              },
              prices: [
                {
                  amount: 94.99,
                  currency_code: "eur",
                },
                {
                  amount: 104.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        
        // Nebula Noir Hoodie
        {
          title: "Nebula Noir Hoodie",
          category_ids: [
            allCategories.find((cat) => cat.name === "Hoodies")!.id,
          ],
          collection_id: saleCollection.id,
          description: "Immerse yourself in cosmic fashion with the Nebula Noir Hoodie. Cozy, durable, and stylish — elevate your look to celestial heights.",
          handle: "nebula-noir-hoodie",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Size",
              values: ["S", "M", "L", "XL"],
            },
          ],
          variants: [
            {
              title: "S",
              sku: "HOODIE-S",
              options: {
                Size: "S",
              },
              prices: [
                {
                  amount: 69.99,
                  currency_code: "eur",
                },
                {
                  amount: 79.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "M",
              sku: "HOODIE-M",
              options: {
                Size: "M",
              },
              prices: [
                {
                  amount: 69.99,
                  currency_code: "eur",
                },
                {
                  amount: 79.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "L",
              sku: "HOODIE-L",
              options: {
                Size: "L",
              },
              prices: [
                {
                  amount: 69.99,
                  currency_code: "eur",
                },
                {
                  amount: 79.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "XL",
              sku: "HOODIE-XL",
              options: {
                Size: "XL",
              },
              prices: [
                {
                  amount: 74.99,
                  currency_code: "eur",
                },
                {
                  amount: 84.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        
        // Exorbita Elegance Elite
        {
          title: "Exorbita Elegance Elite",
          category_ids: [
            allCategories.find((cat) => cat.name === "Accessories")!.id,
          ],
          collection_id: latestDrops.id,
          description: "The Exorbita Elegance Elite watch features kinetic movement technology for timeless elegance. No need for battery changes — a perfect blend of style and innovation.",
          handle: "exorbita-elegance-elite",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Wristband",
              values: ["Leather", "Aluminium"],
            },
            {
              title: "Power",
              values: ["Battery", "Kinetic"],
            },
          ],
          variants: [
            {
              title: "Leather / Battery",
              sku: "EEE-LB",
              options: {
                Wristband: "Leather",
                Power: "Battery",
              },
              prices: [
                {
                  amount: 199.99,
                  currency_code: "eur",
                },
                {
                  amount: 219.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Leather / Kinetic",
              sku: "EEE-LK",
              options: {
                Wristband: "Leather",
                Power: "Kinetic",
              },
              prices: [
                {
                  amount: 249.99,
                  currency_code: "eur",
                },
                {
                  amount: 279.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Aluminium / Battery",
              sku: "EEE-AB",
              options: {
                Wristband: "Aluminium",
                Power: "Battery",
              },
              prices: [
                {
                  amount: 219.99,
                  currency_code: "eur",
                },
                {
                  amount: 239.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Aluminium / Kinetic",
              sku: "EEE-AK",
              options: {
                Wristband: "Aluminium",
                Power: "Kinetic",
              },
              prices: [
                {
                  amount: 269.99,
                  currency_code: "eur",
                },
                {
                  amount: 299.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        
        // Metallic Majesty Illuminator
        {
          title: "Metallic Majesty Illuminator",
          category_ids: [
            allCategories.find((cat) => cat.name === "Furniture")!.id,
          ],
          collection_id: weeklyPicks.id,
          description: "Exquisite steel design lamp with sleek construction, exuding elegance and modernity. Perfect for a warm and inviting ambiance.",
          handle: "metallic-majesty-illuminator",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Plug",
              values: ["US", "EU"],
            },
          ],
          variants: [
            {
              title: "US",
              sku: "MMI-US",
              options: {
                Plug: "US",
              },
              prices: [
                {
                  amount: 129.99,
                  currency_code: "eur",
                },
                {
                  amount: 139.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "EU",
              sku: "MMI-EU",
              options: {
                Plug: "EU",
              },
              prices: [
                {
                  amount: 129.99,
                  currency_code: "eur",
                },
                {
                  amount: 139.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        
        // Audio Arrogance AuralElite
        {
          title: "Audio Arrogance AuralElite",
          category_ids: [
            allCategories.find((cat) => cat.name === "Audio")!.id,
          ],
          collection_id: latestDrops.id,
          description: "Immerse in flawless sound with the Audio Arrogance AuralElite Bluetooth headphones. Enjoy Active Noise Cancellation (ANC) for a premium audio experience.",
          handle: "audio-arrogance-auralElite",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Color",
              values: ["Black", "Silver"],
            },
            {
              title: "Noise Cancelling",
              values: ["ANC", "None"],
            },
          ],
          variants: [
            {
              title: "Black / ANC",
              sku: "AAAE-BA",
              options: {
                Color: "Black",
                "Noise Cancelling": "ANC",
              },
              prices: [
                {
                  amount: 199.99,
                  currency_code: "eur",
                },
                {
                  amount: 219.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Black / None",
              sku: "AAAE-BN",
              options: {
                Color: "Black",
                "Noise Cancelling": "None",
              },
              prices: [
                {
                  amount: 149.99,
                  currency_code: "eur",
                },
                {
                  amount: 169.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Silver / ANC",
              sku: "AAAE-SA",
              options: {
                Color: "Silver",
                "Noise Cancelling": "ANC",
              },
              prices: [
                {
                  amount: 209.99,
                  currency_code: "eur",
                },
                {
                  amount: 229.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "Silver / None",
              sku: "AAAE-SN",
              options: {
                Color: "Silver",
                "Noise Cancelling": "None",
              },
              prices: [
                {
                  amount: 159.99,
                  currency_code: "eur",
                },
                {
                  amount: 179.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        
        // Pinnacle Posh Pack
        {
          title: "Pinnacle Posh Pack",
          category_ids: [
            allCategories.find((cat) => cat.name === "Accessories")!.id,
          ],
          collection_id: saleCollection.id,
          description: "Elevate your travel experience with the luxurious Pinnacle Posh Pack. Crafted from genuine leather, it's durable, stylish, and perfect for modern adventurers.",
          handle: "pinnacle-posh-pack",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Color",
              values: ["Black", "White"],
            },
          ],
          variants: [
            {
              title: "Black",
              sku: "PPP-B",
              options: {
                Color: "Black",
              },
              prices: [
                {
                  amount: 179.99,
                  currency_code: "eur",
                },
                {
                  amount: 199.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "White",
              sku: "PPP-W",
              options: {
                Color: "White",
              },
              prices: [
                {
                  amount: 179.99,
                  currency_code: "eur",
                },
                {
                  amount: 199.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
        
        // Vinyl Virtuoso Opulenza
        {
          title: "Vinyl Virtuoso Opulenza",
          category_ids: [
            allCategories.find((cat) => cat.name === "Audio")!.id,
          ],
          collection_id: weeklyPicks.id,
          description: "Immerse in authentic sound with the Vinyl Virtuoso Opulenza. Vintage-inspired analog turntable that elevates your listening experience with timeless charm.",
          handle: "vinyl-virtuoso-opulenza",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Plug",
              values: ["US", "EU", "UK"],
            },
          ],
          variants: [
            {
              title: "US",
              sku: "VVO-US",
              options: {
                Plug: "US",
              },
              prices: [
                {
                  amount: 249.99,
                  currency_code: "eur",
                },
                {
                  amount: 269.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "EU",
              sku: "VVO-EU",
              options: {
                Plug: "EU",
              },
              prices: [
                {
                  amount: 249.99,
                  currency_code: "eur",
                },
                {
                  amount: 269.99,
                  currency_code: "usd",
                },
              ],
            },
            {
              title: "UK",
              sku: "VVO-UK",
              options: {
                Plug: "UK",
              },
              prices: [
                {
                  amount: 259.99,
                  currency_code: "eur",
                },
                {
                  amount: 279.99,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  });

  logger.info("Importation du catalogue terminée avec succès!");
} 
import {
  createApiKeysWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
  createCollectionsWorkflow,
} from "@medusajs/medusa/core-flows";
import { CreateInventoryLevelInput, ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";

export default async function seedCustomData({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT);
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL);
  const storeModuleService = container.resolve(Modules.STORE);

  // Removed 'gb' from the European countries
  const europeanCountries = ["de", "dk", "se", "fr", "es", "it"];
  const usaCountries = ["us"];

  logger.info("Seeding store data...");
  const [store] = await storeModuleService.listStores();
  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  });

  if (!defaultSalesChannel.length) {
    // create the default sales channel
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    });
    defaultSalesChannel = salesChannelResult;
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [
          {
            currency_code: "eur",
            is_default: true,
          },
          {
            currency_code: "usd",
          },
        ],
        default_sales_channel_id: defaultSalesChannel[0].id,
      },
    },
  });
  
  logger.info("Seeding region data...");
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Europe",
          currency_code: "eur",
          countries: europeanCountries,
          payment_providers: ["pp_system_default", "pp_stripe_stripe"],
        },
        {
          name: "United States",
          currency_code: "usd",
          countries: usaCountries,
          payment_providers: ["pp_system_default", "pp_stripe_stripe"],
        }
      ],
    },
  });
  
  const europeRegion = regionResult.find(r => r.name === "Europe")!;
  const usaRegion = regionResult.find(r => r.name === "United States")!;
  
  logger.info("Finished seeding regions.");

  logger.info("Seeding tax regions...");
  // Combine both European and USA countries for tax regions
  await createTaxRegionsWorkflow(container).run({
    input: [...europeanCountries, ...usaCountries].map((country_code) => ({
      country_code,
    })),
  });
  logger.info("Finished seeding tax regions.");

  logger.info("Seeding stock location data...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "European Warehouse",
          address: {
            city: "Copenhagen",
            country_code: "DK",
            address_1: "",
          },
        },
        {
          name: "US Warehouse",
          address: {
            city: "New York",
            country_code: "US",
            address_1: "",
          },
        }
      ],
    },
  });
  const euStockLocation = stockLocationResult[0];
  const usStockLocation = stockLocationResult[1];

  // Link the warehouses to the manual fulfillment provider
  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: euStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });
  
  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: usStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  logger.info("Seeding fulfillment data...");
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default"
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null

  if (!shippingProfile) {
    const { result: shippingProfileResult } =
    await createShippingProfilesWorkflow(container).run({
      input: {
        data: [
          {
            name: "Default Shipping Profile",
            type: "default",
          },
        ],
      },
    });
    shippingProfile = shippingProfileResult[0];
  }

  // Create fulfillment sets for Europe
  const euFulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "European Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Europe",
        geo_zones: [
          {
            country_code: "de",
            type: "country",
          },
          {
            country_code: "dk",
            type: "country",
          },
          {
            country_code: "se",
            type: "country",
          },
          {
            country_code: "fr",
            type: "country",
          },
          {
            country_code: "es",
            type: "country",
          },
          {
            country_code: "it",
            type: "country",
          },
        ],
      },
    ],
  });

  // Create fulfillment sets for USA
  const usFulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "US Warehouse delivery",
    type: "shipping",
    service_zones: [
      {
        name: "United States",
        geo_zones: [
          {
            country_code: "us",
            type: "country",
          }
        ],
      },
    ],
  });

  // Link fulfillment sets to stock locations
  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: euStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: euFulfillmentSet.id,
    },
  });

  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: usStockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_set_id: usFulfillmentSet.id,
    },
  });

  // Create shipping options for both regions
  await createShippingOptionsWorkflow(container).run({
    input: [
      // Europe shipping options
      {
        name: "Standard Shipping (Europe)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: euFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 10,
          },
          {
            currency_code: "eur",
            amount: 10,
          },
          {
            region_id: europeRegion.id,
            amount: 10,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping (Europe)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: euFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 15,
          },
          {
            currency_code: "eur",
            amount: 15,
          },
          {
            region_id: europeRegion.id,
            amount: 15,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      // US shipping options
      {
        name: "Standard Shipping (US)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: usFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Ship in 2-3 days.",
          code: "standard",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 5,
          },
          {
            region_id: usaRegion.id,
            amount: 5,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
      {
        name: "Express Shipping (US)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: usFulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Express",
          description: "Ship in 24 hours.",
          code: "express",
        },
        prices: [
          {
            currency_code: "usd",
            amount: 12,
          },
          {
            region_id: usaRegion.id,
            amount: 12,
          },
        ],
        rules: [
          {
            attribute: "enabled_in_store",
            value: "true",
            operator: "eq",
          },
          {
            attribute: "is_return",
            value: "false",
            operator: "eq",
          },
        ],
      },
    ],
  });
  logger.info("Finished seeding fulfillment data.");

  // Link sales channels to stock locations
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: euStockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  
  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: usStockLocation.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  
  logger.info("Finished seeding stock location data.");

  logger.info("Seeding publishable API key data...");
  const { result: publishableApiKeyResult } = await createApiKeysWorkflow(
    container
  ).run({
    input: {
      api_keys: [
        {
          title: "Webshop",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });
  const publishableApiKey = publishableApiKeyResult[0];

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel[0].id],
    },
  });
  logger.info("Finished seeding publishable API key data.");

  // The rest of the product data seeding remains the same as the original script
  logger.info("Seeding product data...");

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

  // Fetch all categories to use in product creation
  const { data: allCategories } = await query.graph({
    entity: "product_category",
    fields: ["id", "name", "parent_category_id"],
  });

  // Après la création des catégories et avant la création des produits
  logger.info("Seeding product collections...");
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
        
        // Nouveau produit: Corporate Commando Throne
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
        
        // Nouveau produit: Decibel Dominator Deluxe
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
        
        // Nouveau produit: Nebula Noir Hoodie
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
        
        // Nouveau produit: Exorbita Elegance Elite
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
        
        // Nouveau produit: Metallic Majesty Illuminator
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
        
        // Nouveau produit: Audio Arrogance AuralElite
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
        
        // Nouveau produit: Pinnacle Posh Pack
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
        
        // Nouveau produit: Vinyl Virtuoso Opulenza
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
  logger.info("Finished seeding product data.");

  logger.info("Seeding inventory levels.");

  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id"],
  });

  // Create inventory levels for both warehouses
  const inventoryLevels: CreateInventoryLevelInput[] = [];
  for (const inventoryItem of inventoryItems) {
    // European warehouse inventory
    inventoryLevels.push({
      location_id: euStockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    });
    
    // US warehouse inventory
    inventoryLevels.push({
      location_id: usStockLocation.id,
      stocked_quantity: 1000000,
      inventory_item_id: inventoryItem.id,
    });
  }

  await createInventoryLevelsWorkflow(container).run({
    input: {
      inventory_levels: inventoryLevels,
    },
  });

  logger.info("Finished seeding inventory levels data.");
} 
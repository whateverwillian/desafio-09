import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateProductService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // Checka se o usuário é válido
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) throw new AppError('Invalid customer id');

    // Checka se os produtos são válidos
    const requestedProductIds = products.map(requestedProduct => ({
      id: requestedProduct.id,
    }));

    const productsInStock = await this.productsRepository.findAllById(
      requestedProductIds,
    );

    const validProducts = products.length === productsInStock.length;

    if (!validProducts) throw new AppError("You can't buy a invalid product");

    const updatedQuantities: IProduct[] = [];

    // Vamos percorrer cada um dos produtos
    const orderProducts = productsInStock.map(stock => {
      // Vamos achar o requestProduct relacionado
      const i = products.findIndex(self => self.id === stock.id);
      const cart = products[i];

      // Vamos checkar se tem o suficiente em estoque
      if (cart.quantity > stock.quantity) {
        throw new AppError(
          `Sorry, we don't have enough ${stock.name} in stock.` +
            `Requested ${cart.quantity}.` +
            `Available ${stock.quantity}.`,
        );
      }

      // atualizamos o estoque
      updatedQuantities.push({
        id: stock.id,
        quantity: stock.quantity - cart.quantity,
      });

      // Retornando os dados pro pedido
      return {
        product_id: stock.id,
        price: stock.price,
        quantity: cart.quantity,
      };
    });

    // Fazendo o update no estoque
    await this.productsRepository.updateQuantity(updatedQuantities);

    // Criando o pedido
    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    return order;
  }
}

export default CreateProductService;

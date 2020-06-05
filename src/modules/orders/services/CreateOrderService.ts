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
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) throw new AppError('Invalid customer id');

    const requestedProductIds = products.map(requestedProduct => ({
      id: requestedProduct.id,
    }));

    const productsInStock = await this.productsRepository.findAllById(
      requestedProductIds,
    );

    const validProducts = products.length === productsInStock.length;
    if (!validProducts) throw new AppError("You can't buy a invalid product");

    const updatedQuantities: IProduct[] = [];

    const orderProducts = productsInStock.map(stock => {
      const i = products.findIndex(self => self.id === stock.id);
      const cart = products[i];

      if (cart.quantity > stock.quantity) {
        throw new AppError(
          `Sorry, we don't have enough ${stock.name} in stock.` +
            `Requested ${cart.quantity}.` +
            `Available ${stock.quantity}.`,
        );
      }

      updatedQuantities.push({
        id: stock.id,
        quantity: stock.quantity - cart.quantity,
      });

      return {
        product_id: stock.id,
        price: stock.price,
        quantity: cart.quantity,
      };
    });

    await this.productsRepository.updateQuantity(updatedQuantities);

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    return order;
  }
}

export default CreateProductService;
